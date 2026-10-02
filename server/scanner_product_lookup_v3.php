<?php
declare(strict_types=1);

require __DIR__ . '/mobile-auth/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bl_mobile_json(405, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'method_not_allowed']);
}

// Dokładnie ten sam mechanizm Accessis co działające mobile-auth/me.php
// i scanner_product_lookup_v2.php. Bez wewnętrznego requestu OVH -> OVH.
$ctx = bl_mobile_require_scanner('view');
$data = bl_mobile_input();
if (!$data) {
    bl_mobile_json(400, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'empty_body']);
}

$type = strtoupper(trim((string)($data['type'] ?? 'PRODUCT_LOOKUP')));
$shop = preg_replace('/\D+/', '', (string)($data['shop'] ?? BL_MOBILE_SHOP_CODE));
if ($shop !== BL_MOBILE_SHOP_CODE) {
    bl_mobile_json(403, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'shop_forbidden','shop'=>$shop]);
}

$dataDir = dirname(__DIR__) . '/_data/' . $shop;
$cache = $dataDir . '/products.lookup.tsv';
$metaPath = $dataDir . '/products.meta.json';

$dbMeta = [
    'reportDate' => null,
    'reportDateRaw' => null,
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
        if (isset($meta['rows'])) $dbMeta['rows'] = (int)$meta['rows'];
        if (isset($meta['activeRows'])) $dbMeta['activeRows'] = (int)$meta['activeRows'];
    }
}

if ($type === 'PRODUCT_META') {
    if (!is_file($cache) || !is_readable($cache)) {
        bl_mobile_json(503, ['ok'=>false,'kind'=>'PRODUCT_META','error'=>'lookup_cache_missing','database'=>$dbMeta]);
    }
    bl_mobile_json(200, [
        'ok'=>true,
        'kind'=>'PRODUCT_META',
        'shop'=>$shop,
        'database'=>$dbMeta,
        'auth'=>[
            'permission'=>(string)($ctx['user']['permission'] ?? 'view'),
            'login'=>(string)($ctx['user']['login'] ?? ''),
        ],
    ]);
}

if ($type !== 'PRODUCT_LOOKUP') {
    bl_mobile_json(400, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'invalid_type']);
}

$ean = preg_replace('/\D+/', '', (string)($data['ean'] ?? ''));
if (!in_array(strlen($ean), [8,13], true)) {
    bl_mobile_json(400, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'invalid_ean','ean'=>$ean,'database'=>$dbMeta]);
}
if (!is_file($cache) || !is_readable($cache)) {
    bl_mobile_json(503, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'lookup_cache_missing','ean'=>$ean,'database'=>$dbMeta]);
}

$fh = fopen($cache, 'rb');
if ($fh === false) {
    bl_mobile_json(500, ['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'lookup_cache_open_failed','ean'=>$ean,'database'=>$dbMeta]);
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
    bl_mobile_json(200, [
        'ok'=>true,'kind'=>'PRODUCT_LOOKUP','found'=>false,
        'ean'=>$ean,'shop'=>$shop,'database'=>$dbMeta,
    ]);
}

$columns = [];
if (is_array($header)) {
    foreach ($header as $i=>$name) $columns[trim((string)$name)] = $i;
}
$get = static function(string $name, string $fallback='') use ($columns, $found): string {
    if (!isset($columns[$name])) return $fallback;
    return trim((string)($found[$columns[$name]] ?? $fallback));
};

$activeRaw = strtolower($get('AKTYWNY'));
$active = in_array($activeRaw, ['tak','1','true','yes'], true);
$unit = $get('JED');
$weightRaw = $get('WAGA');
$coliRaw = $get('COLI');
$weight = is_numeric(str_replace(',', '.', $weightRaw)) ? (float)str_replace(',', '.', $weightRaw) : 0.0;
$coli = is_numeric(str_replace(',', '.', $coliRaw)) ? (float)str_replace(',', '.', $coliRaw) : 0.0;
$factor = $weight > 0 ? $weight : ($coli > 0 ? $coli : 1.0);

bl_mobile_json(200, [
    'ok'=>true,
    'kind'=>'PRODUCT_LOOKUP',
    'found'=>true,
    'ean'=>$ean,
    'shop'=>$shop,
    'database'=>$dbMeta,
    'product'=>[
        'ean'=>$ean,
        'name'=>$get('NAZWA'),
        'stock'=>$get('STAN'),
        'purchasePrice'=>$get('CENA_ZAKUPU'),
        'salePrice'=>$get('CENA_SPRZEDAZY'),
        'brand'=>$get('MARKA'),
        'active'=>$active,
        'unit'=>$unit,
        'weight'=>$weight,
        'coli'=>$coli,
        'factor'=>$factor,
    ],
]);
