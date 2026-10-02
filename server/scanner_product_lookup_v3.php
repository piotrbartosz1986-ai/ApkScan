<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function post_json(string $url, array $payload, string $accessToken): array {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return [0, null, 'json_encode_failed'];

    $headers = [
        'Content-Type: application/json; charset=utf-8',
        'Accept: application/json',
        'Cache-Control: no-store',
        'Authorization: Bearer ' . $accessToken,
        'X-BricoLab-Access-Token: ' . $accessToken,
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) return [0, null, 'curl_init_failed'];
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $json,
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false) return [$code, null, $err !== '' ? $err : 'curl_failed'];
        $decoded = json_decode((string)$body, true);
        return [$code, is_array($decoded) ? $decoded : null, (string)$body];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $json,
            'timeout' => 15,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    $code = 0;
    $responseHeaders = $http_response_header ?? [];
    if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', (string)$responseHeaders[0], $m)) {
        $code = (int)$m[1];
    }
    if ($body === false) return [$code, null, 'http_request_failed'];
    $decoded = json_decode((string)$body, true);
    return [$code, is_array($decoded) ? $decoded : null, (string)$body];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(405, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'method_not_allowed']);
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    out(400, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'empty_body']);
}
if (strlen($raw) > 65536) {
    out(413, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'payload_too_large']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    out(400, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'invalid_json']);
}

/*
 * V3: no legacy scanner key. The mobile Accessis session is the only authorization.
 * We validate the exact same _bricoAccessToken through mobile-auth/me.php.
 */
$accessToken = trim((string)($data['_bricoAccessToken'] ?? ''));
if ($accessToken === '') {
    out(401, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'accessis_token_missing']);
}

$deviceId = trim((string)($data['deviceId'] ?? ''));
$deviceName = trim((string)($data['deviceName'] ?? 'Brico Scanner'));
$appVersion = trim((string)($data['appVersion'] ?? 'scanner-product-v3'));

$authPayload = [
    '_bricoAccessToken' => $accessToken,
    'deviceId' => $deviceId,
    'deviceName' => $deviceName,
    'appVersion' => $appVersion,
];

[$authCode, $authJson, $authRaw] = post_json(
    'https://bricolab.pl/BricoLab/api/mobile-auth/me.php',
    $authPayload,
    $accessToken
);

if ($authCode === 401) {
    out(401, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'accessis_session_expired']);
}
if ($authCode === 403 || $authCode === 428) {
    $error = is_array($authJson) ? trim((string)($authJson['error'] ?? 'scanner_forbidden')) : 'scanner_forbidden';
    out($authCode, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => $error]);
}
if ($authCode < 200 || $authCode >= 300 || !is_array($authJson) || empty($authJson['ok'])) {
    out(502, [
        'ok' => false,
        'kind' => 'PRODUCT_LOOKUP',
        'error' => 'accessis_verify_failed',
        'authHttpCode' => $authCode,
    ]);
}

$user = $authJson['user'] ?? null;
if (!is_array($user)) {
    out(502, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'accessis_user_missing']);
}

$permission = strtolower(trim((string)($user['permission'] ?? 'none')));
$globalOwner = !empty($user['globalOwner']);
if (!$globalOwner && !in_array($permission, ['view', 'edit'], true)) {
    out(403, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'scanner_forbidden']);
}

// Never pass the session token further into lookup data handling.
unset($data['_bricoAccessToken']);

$type = strtoupper(trim((string)($data['type'] ?? 'PRODUCT_LOOKUP')));
$shop = preg_replace('/\D+/', '', (string)($data['shop'] ?? '08042'));
if ($shop === '') $shop = '08042';

$dataDir = dirname(__DIR__) . '/_data/' . $shop;
$cache = $dataDir . '/products.lookup.tsv';
$metaPath = $dataDir . '/products.meta.json';
$dbMeta = [
    'reportDate' => null,
    'stale' => null,
    'cacheModified' => is_file($cache) ? gmdate('c', (int)filemtime($cache)) : null,
];

if (is_file($metaPath) && is_readable($metaPath)) {
    $metaRaw = file_get_contents($metaPath);
    $meta = $metaRaw !== false ? json_decode($metaRaw, true) : null;
    if (is_array($meta)) {
        $dbMeta['reportDate'] = trim((string)($meta['reportDate'] ?? '')) ?: null;
        $dbMeta['reportDateRaw'] = trim((string)($meta['reportDateRaw'] ?? '')) ?: null;
        if (array_key_exists('stale', $meta)) $dbMeta['stale'] = (bool)$meta['stale'];
    }
}

if ($type === 'PRODUCT_META') {
    if (!is_file($cache) || !is_readable($cache)) {
        out(503, ['ok' => false, 'kind' => 'PRODUCT_META', 'error' => 'lookup_cache_missing', 'database' => $dbMeta]);
    }
    out(200, [
        'ok' => true,
        'kind' => 'PRODUCT_META',
        'shop' => $shop,
        'database' => $dbMeta,
        'auth' => ['permission' => $globalOwner ? 'edit' : $permission],
    ]);
}

if ($type !== 'PRODUCT_LOOKUP') {
    out(400, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'invalid_type']);
}

$ean = preg_replace('/\D+/', '', (string)($data['ean'] ?? ''));
if (!in_array(strlen($ean), [8, 13], true)) {
    out(400, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'invalid_ean', 'ean' => $ean, 'database' => $dbMeta]);
}
if (!is_file($cache) || !is_readable($cache)) {
    out(503, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'lookup_cache_missing', 'ean' => $ean, 'database' => $dbMeta]);
}

$fh = fopen($cache, 'rb');
if ($fh === false) {
    out(500, ['ok' => false, 'kind' => 'PRODUCT_LOOKUP', 'error' => 'lookup_cache_open_failed', 'ean' => $ean, 'database' => $dbMeta]);
}

$header = fgetcsv($fh, 0, "\t");
$found = null;
while (($row = fgetcsv($fh, 0, "\t")) !== false) {
    if (isset($row[0]) && (string)$row[0] === $ean) {
        $found = $row;
        break;
    }
}
fclose($fh);

if ($found === null) {
    out(200, [
        'ok' => true,
        'kind' => 'PRODUCT_LOOKUP',
        'found' => false,
        'ean' => $ean,
        'shop' => $shop,
        'database' => $dbMeta,
    ]);
}

$columns = [];
if (is_array($header)) {
    foreach ($header as $i => $name) $columns[trim((string)$name)] = $i;
}
$get = static function (string $name, string $fallback = '') use ($columns, $found): string {
    if (!isset($columns[$name])) return $fallback;
    return trim((string)($found[$columns[$name]] ?? $fallback));
};

$activeRaw = strtolower($get('AKTYWNY'));
$active = in_array($activeRaw, ['tak', '1', 'true', 'yes'], true);
$unit = $get('JED');
$weightRaw = $get('WAGA');
$coliRaw = $get('COLI');
$weight = is_numeric(str_replace(',', '.', $weightRaw)) ? (float)str_replace(',', '.', $weightRaw) : 0.0;
$coli = is_numeric(str_replace(',', '.', $coliRaw)) ? (float)str_replace(',', '.', $coliRaw) : 0.0;
$factor = $weight > 0 ? $weight : ($coli > 0 ? $coli : 1.0);

out(200, [
    'ok' => true,
    'kind' => 'PRODUCT_LOOKUP',
    'found' => true,
    'ean' => $ean,
    'shop' => $shop,
    'database' => $dbMeta,
    'product' => [
        'ean' => $ean,
        'name' => $get('NAZWA'),
        'stock' => $get('STAN'),
        'purchasePrice' => $get('CENA_ZAKUPU'),
        'salePrice' => $get('CENA_SPRZEDAZY'),
        'brand' => $get('MARKA'),
        'active' => $active,
        'unit' => $unit,
        'weight' => $weight,
        'coli' => $coli,
        'factor' => $factor,
    ],
]);
