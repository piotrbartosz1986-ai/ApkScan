<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
function auth_header(): string {
    $auth=(string)($_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'');
    if($auth!=='') return $auth;
    if(function_exists('getallheaders')) foreach(getallheaders() as $n=>$v) if(strcasecmp((string)$n,'Authorization')===0) return (string)$v;
    return '';
}
function clean_text(mixed $value,int $max=120): string {
    $v=trim((string)$value);
    $v=preg_replace('/[\x00-\x1F\x7F]+/u',' ',$v)??'';
    $v=preg_replace('/\s+/u',' ',$v)??'';
    if(function_exists('mb_substr')) return mb_substr($v,0,$max,'UTF-8');
    return substr($v,0,$max);
}
function slugify(string $value,int $max=46): string {
    $map=['ą'=>'a','ć'=>'c','ę'=>'e','ł'=>'l','ń'=>'n','ó'=>'o','ś'=>'s','ź'=>'z','ż'=>'z','Ą'=>'A','Ć'=>'C','Ę'=>'E','Ł'=>'L','Ń'=>'N','Ó'=>'O','Ś'=>'S','Ź'=>'Z','Ż'=>'Z'];
    $v=strtr($value,$map);
    if(function_exists('iconv')){
        $x=@iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$v);
        if(is_string($x)&&$x!=='')$v=$x;
    }
    $v=strtolower($v);
    $v=preg_replace('/[^a-z0-9]+/','-',$v)??'';
    $v=trim($v,'-');
    if($v==='')$v='lista';
    return substr($v,0,$max);
}

if($_SERVER['REQUEST_METHOD']!=='POST') out(405,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'method_not_allowed']);
$raw=file_get_contents('php://input');
if($raw===false||trim($raw)==='') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'empty_body']);
if(strlen($raw)>2*1024*1024) out(413,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'payload_too_large']);
$data=json_decode($raw,true);
if(!is_array($data)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_json']);

$config=null;
foreach([dirname(__DIR__,2).'/api/_config.php',dirname(__DIR__,2).'/scanner/_config.php',__DIR__.'/_config.php'] as $candidate){
    if(is_file($candidate)){ $tmp=require $candidate; if(is_array($tmp)&&isset($tmp['token'])){$config=$tmp;break;} }
}
if(!is_array($config)||!isset($config['token'])) out(500,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'scanner_config_not_found']);
$provided=''; $auth=auth_header();
if(preg_match('/^Bearer\s+(.+)$/i',$auth,$m)) $provided=trim((string)$m[1]);
if($provided==='') $provided=trim((string)($_SERVER['HTTP_X_BRICO_TOKEN']??''));
if($provided===''||!hash_equals((string)$config['token'],$provided)) out(401,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'unauthorized']);
if(strtoupper(trim((string)($data['type']??'')))!=='UNIT_CONVERTERS') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_type']);

$subject=clean_text($data['subject']??'',100);
$worker=clean_text($data['worker']??'',100);
$department=clean_text($data['department']??'',40);
$departments=['Dekoracja','Majsterkowanie','Budowlanka','Ogród','Kasy'];
if($subject==='') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'subject_required']);
if($worker==='') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'worker_required']);
if(!in_array($department,$departments,true)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'department_required']);
$title=$subject.' — '.$worker.' — '.$department;

$items=$data['items']??null;
if(!is_array($items)||count($items)===0) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'items_required']);
if(count($items)>10000) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'too_many_items']);
$allowed=['szt.','L','kg','mb','m2','g','m','ml','m3','A.Wa','Tuzin'];
$clean=[];
foreach($items as $item){
    if(!is_array($item)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_item']);
    $ean=preg_replace('/\D+/','',(string)($item['ean']??''));
    if(!in_array(strlen($ean),[8,13],true)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_ean','value'=>$ean]);
    $unit=trim((string)($item['unit']??''));
    if(!in_array($unit,$allowed,true)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_unit','ean'=>$ean,'unit'=>$unit]);
    $contentRaw=str_replace(',','.',(string)($item['content']??''));
    if(!is_numeric($contentRaw)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_content','ean'=>$ean]);
    $content=(float)$contentRaw;
    if(!is_finite($content)||$content<=0||$content>1000000000) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'invalid_content','ean'=>$ean]);
    $name=clean_text($item['name']??'',200);
    $clean[]=['ean'=>$ean,'name'=>$name,'unit'=>$unit,'content'=>$content,'changedAt'=>(string)($item['changedAt']??'')];
}

$shop=preg_replace('/\D+/','',(string)($data['shop']??'08042')); if($shop==='')$shop='08042';
$dir=dirname(__DIR__).'/_data/'.$shop.'/converters';
if(!is_dir($dir)&&!mkdir($dir,0755,true)) out(500,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'cannot_create_converter_dir']);
$created=gmdate('c');
$device=preg_replace('/[^A-Za-z0-9._-]/','_',trim((string)($data['device']??'BricoScanner'))); $device=substr($device?:'BricoScanner',0,40);
$payload=[
    'version'=>2,
    'type'=>'UNIT_CONVERTERS',
    'created'=>(string)($data['created']??$created),
    'received'=>$created,
    'shop'=>$shop,
    'device'=>$device,
    'subject'=>$subject,
    'worker'=>$worker,
    'department'=>$department,
    'title'=>$title,
    'items'=>$clean,
];
$file='converters_'.slugify($subject).'_'.slugify($worker).'_'.slugify($department,24).'_'.gmdate('Ymd_His').'_'.bin2hex(random_bytes(2)).'.json';
$path=$dir.'/'.$file;
$json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
if($json===false||file_put_contents($path,$json,LOCK_EX)===false) out(500,['ok'=>false,'kind'=>'UNIT_CONVERTERS','error'=>'write_failed']);
out(201,['ok'=>true,'kind'=>'UNIT_CONVERTERS','converterUpload'=>true,'file'=>$file,'title'=>$title,'items'=>count($clean),'shop'=>$shop]);
