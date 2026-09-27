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
function read_json_file(string $path): ?array {
    $raw=@file_get_contents($path);
    if($raw===false) return null;
    $data=json_decode($raw,true);
    return is_array($data)?$data:null;
}
function normalize_status(string $status): string {
    $status=strtoupper(trim($status));
    if($status==='PREPARED') $status='READY';
    return in_array($status,['NEW','READY','CHANGED'],true)?$status:'NEW';
}
function converters_dir(string $shop): string { return dirname(__DIR__).'/_data/'.$shop.'/converters'; }
function status_dir(string $shop): string { return converters_dir($shop).'/_status'; }
function valid_file(string $file): bool { return (bool)preg_match('/^converters_[A-Za-z0-9._-]+\.json$/',$file); }
function data_path(string $shop,string $file): ?string {
    $file=basename($file);
    if(!valid_file($file)) return null;
    $path=converters_dir($shop).'/'.$file;
    return is_file($path)?$path:null;
}
function status_path(string $shop,string $file): string { return status_dir($shop).'/'.basename($file).'.status.json'; }
function read_status(string $shop,string $file): array {
    $base=['status'=>'NEW','updatedAt'=>null,'lastExportedAt'=>null,'readyAt'=>null,'changedAt'=>null,'changedBy'=>null];
    $path=status_path($shop,$file);
    if(!is_file($path)) return $base;
    $data=read_json_file($path);
    if(!is_array($data)) return $base;
    $state=array_merge($base,$data);
    $state['status']=normalize_status((string)($state['status']??'NEW'));
    return $state;
}
function write_status(string $shop,string $file,array $patch): bool {
    $dir=status_dir($shop);
    if(!is_dir($dir)&&!@mkdir($dir,0755,true)) return false;
    $state=array_merge(read_status($shop,$file),$patch,['file'=>basename($file),'shop'=>$shop]);
    $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
    return $json!==false && @file_put_contents(status_path($shop,$file),$json,LOCK_EX)!==false;
}
function batch_summary(string $shop,string $file,bool $withItems=false): ?array {
    $path=data_path($shop,$file);
    if($path===null) return null;
    $data=read_json_file($path);
    if(!is_array($data)) return null;
    $items=is_array($data['items']??null)?$data['items']:[];
    $state=read_status($shop,$file);
    $row=[
        'file'=>basename($file),
        'created'=>(string)($data['created']??''),
        'received'=>(string)($data['received']??''),
        'device'=>(string)($data['device']??''),
        'shop'=>(string)($data['shop']??$shop),
        'count'=>count($items),
        'status'=>$state['status'],
        'updatedAt'=>$state['updatedAt']??null,
        'readyAt'=>$state['readyAt']??null,
        'changedAt'=>$state['changedAt']??null,
        'changedBy'=>$state['changedBy']??null,
    ];
    if($withItems) $row['items']=$items;
    return $row;
}

if($_SERVER['REQUEST_METHOD']!=='POST') out(405,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'method_not_allowed']);
$raw=file_get_contents('php://input');
if($raw===false||trim($raw)==='') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'empty_body']);
if(strlen($raw)>1024*1024) out(413,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'payload_too_large']);
$data=json_decode($raw,true);
if(!is_array($data)) out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'invalid_json']);

$config=null;
foreach([dirname(__DIR__,2).'/api/_config.php',dirname(__DIR__,2).'/scanner/_config.php',__DIR__.'/_config.php'] as $candidate){
    if(is_file($candidate)){ $tmp=require $candidate; if(is_array($tmp)&&isset($tmp['token'])){$config=$tmp;break;} }
}
if(!is_array($config)||!isset($config['token'])) out(500,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'scanner_config_not_found']);
$provided=''; $auth=auth_header();
if(preg_match('/^Bearer\s+(.+)$/i',$auth,$m)) $provided=trim((string)$m[1]);
if($provided==='') $provided=trim((string)($_SERVER['HTTP_X_BRICO_TOKEN']??''));
if($provided===''||!hash_equals((string)$config['token'],$provided)) out(401,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'unauthorized']);

$type=strtoupper(trim((string)($data['type']??'')));
if($type!=='' && $type!=='UNIT_CONVERTERS_STATUS') out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'invalid_type']);
$shop=preg_replace('/\D+/','',(string)($data['shop']??'08042')) ?: '08042';
$action=strtolower(trim((string)($data['action']??'list')));

if($action==='list'){
    $dir=converters_dir($shop);
    $files=is_dir($dir)?(glob($dir.'/converters_*.json')?:[]):[];
    usort($files,static fn(string $a,string $b):int=>(filemtime($b)?:0)<=>(filemtime($a)?:0));
    $rows=[];
    foreach(array_slice($files,0,200) as $path){
        $row=batch_summary($shop,basename($path),false);
        if($row!==null) $rows[]=$row;
    }
    $ready=0; foreach($rows as $r) if(($r['status']??'')==='READY') $ready++;
    out(200,['ok'=>true,'kind'=>'UNIT_CONVERTERS_STATUS','action'=>'list','shop'=>$shop,'ready'=>$ready,'lists'=>$rows]);
}

$file=basename((string)($data['file']??''));
if(!valid_file($file)||data_path($shop,$file)===null) out(404,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'list_not_found']);

if($action==='detail'){
    $row=batch_summary($shop,$file,true);
    out(200,['ok'=>true,'kind'=>'UNIT_CONVERTERS_STATUS','action'=>'detail','list'=>$row]);
}

if($action==='changed'){
    $state=read_status($shop,$file);
    $current=$state['status'];
    if($current==='CHANGED') out(200,['ok'=>true,'kind'=>'UNIT_CONVERTERS_STATUS','action'=>'changed','file'=>$file,'status'=>'CHANGED','already'=>true]);
    if($current!=='READY') out(409,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'not_ready','status'=>$current]);
    $now=gmdate('c');
    if(!write_status($shop,$file,['status'=>'CHANGED','updatedAt'=>$now,'changedAt'=>$now,'changedBy'=>'scanner'])) out(500,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'status_write_failed']);
    out(200,['ok'=>true,'kind'=>'UNIT_CONVERTERS_STATUS','action'=>'changed','file'=>$file,'status'=>'CHANGED']);
}

out(400,['ok'=>false,'kind'=>'UNIT_CONVERTERS_STATUS','error'=>'invalid_action']);
