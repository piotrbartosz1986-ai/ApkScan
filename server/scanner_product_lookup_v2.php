<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function out(int $code, array $data): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function auth_header(): string {
    $auth=(string)($_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'');
    if($auth!=='') return $auth;
    if(function_exists('getallheaders')) foreach(getallheaders() as $name=>$value) if(strcasecmp((string)$name,'Authorization')===0) return (string)$value;
    return '';
}
if($_SERVER['REQUEST_METHOD']!=='POST') out(405,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'method_not_allowed']);
$raw=file_get_contents('php://input');
if($raw===false||trim($raw)==='') out(400,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'empty_body']);
if(strlen($raw)>65536) out(413,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'payload_too_large']);
$data=json_decode($raw,true); if(!is_array($data)) out(400,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'invalid_json']);
$config=null;
foreach([dirname(__DIR__,2).'/api/_config.php',dirname(__DIR__,2).'/scanner/_config.php',__DIR__.'/_config.php'] as $candidate){
    if(is_file($candidate)){ $tmp=require $candidate; if(is_array($tmp)&&isset($tmp['token'])){$config=$tmp;break;} }
}
if(!is_array($config)||!isset($config['token'])) out(500,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'scanner_config_not_found']);
$provided='';$auth=auth_header();if(preg_match('/^Bearer\s+(.+)$/i',$auth,$m))$provided=trim((string)$m[1]);
if($provided==='')$provided=trim((string)($_SERVER['HTTP_X_BRICO_TOKEN']??''));
if($provided===''||!hash_equals((string)$config['token'],$provided))out(401,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'unauthorized']);
$type=strtoupper(trim((string)($data['type']??'PRODUCT_LOOKUP')));$shop=preg_replace('/\D+/','',(string)($data['shop']??'08042'));if($shop==='')$shop='08042';
$dataDir=dirname(__DIR__).'/_data/'.$shop;$cache=$dataDir.'/products.lookup.tsv';$metaPath=$dataDir.'/products.meta.json';
$dbMeta=['reportDate'=>null,'stale'=>null,'cacheModified'=>is_file($cache)?gmdate('c',(int)filemtime($cache)):null];
if(is_file($metaPath)&&is_readable($metaPath)){
    $metaRaw=file_get_contents($metaPath);$meta=$metaRaw!==false?json_decode($metaRaw,true):null;
    if(is_array($meta)){$dbMeta['reportDate']=trim((string)($meta['reportDate']??''))?:null;$dbMeta['reportDateRaw']=trim((string)($meta['reportDateRaw']??''))?:null;}
}
if($type==='PRODUCT_META'){
    if(!is_file($cache)||!is_readable($cache))out(503,['ok'=>false,'kind'=>'PRODUCT_META','error'=>'lookup_cache_missing','database'=>$dbMeta]);
    out(200,['ok'=>true,'kind'=>'PRODUCT_META','shop'=>$shop,'database'=>$dbMeta]);
}
if($type!=='PRODUCT_LOOKUP')out(400,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'invalid_type']);
$ean=preg_replace('/\D+/','',(string)($data['ean']??''));if(!in_array(strlen($ean),[8,13],true))out(400,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'invalid_ean','ean'=>$ean,'database'=>$dbMeta]);
if(!is_file($cache)||!is_readable($cache))out(503,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'lookup_cache_missing','ean'=>$ean,'database'=>$dbMeta]);
$fh=fopen($cache,'rb');if($fh===false)out(500,['ok'=>false,'kind'=>'PRODUCT_LOOKUP','error'=>'lookup_cache_open_failed','ean'=>$ean,'database'=>$dbMeta]);
$header=fgetcsv($fh,0,"\t");$found=null;while(($row=fgetcsv($fh,0,"\t"))!==false){if(isset($row[0])&&(string)$row[0]===$ean){$found=$row;break;}}fclose($fh);
if($found===null)out(200,['ok'=>true,'kind'=>'PRODUCT_LOOKUP','found'=>false,'ean'=>$ean,'shop'=>$shop,'database'=>$dbMeta]);
$columns=[];if(is_array($header))foreach($header as $i=>$name)$columns[trim((string)$name)]=$i;
$get=static function(string $name,string $fallback='')use($columns,$found):string{if(!isset($columns[$name]))return $fallback;return trim((string)($found[$columns[$name]]??$fallback));};
$activeRaw=strtolower($get('AKTYWNY'));$active=in_array($activeRaw,['tak','1','true','yes'],true);$unit=$get('JED');
$weightRaw=$get('WAGA');$coliRaw=$get('COLI');$weight=is_numeric(str_replace(',','.',$weightRaw))?(float)str_replace(',','.',$weightRaw):0.0;$coli=is_numeric(str_replace(',','.',$coliRaw))?(float)str_replace(',','.',$coliRaw):0.0;$factor=$weight>0?$weight:($coli>0?$coli:1.0);
out(200,['ok'=>true,'kind'=>'PRODUCT_LOOKUP','found'=>true,'ean'=>$ean,'shop'=>$shop,'database'=>$dbMeta,'product'=>['ean'=>$ean,'name'=>$get('NAZWA'),'stock'=>$get('STAN'),'purchasePrice'=>$get('CENA_ZAKUPU'),'salePrice'=>$get('CENA_SPRZEDAZY'),'brand'=>$get('MARKA'),'active'=>$active,'unit'=>$unit,'weight'=>$weight,'coli'=>$coli,'factor'=>$factor]]);
