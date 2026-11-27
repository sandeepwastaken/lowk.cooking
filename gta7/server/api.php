<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
$origin=$_SERVER['HTTP_ORIGIN']??'';
$scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'http';
$sameOrigin=$scheme.'://'.($_SERVER['HTTP_HOST']??'localhost');
$allowed=array_values(array_unique(array_filter([$sameOrigin,config()['origin'],...config()['origins']])));
if ($origin !== '' && !in_array($origin,$allowed,true)) fail(403,'This room server only accepts its own site');
if ($origin !== '') { header('Access-Control-Allow-Origin: '.$origin); header('Vary: Origin'); }
if (($_SERVER['REQUEST_METHOD']??'')==='OPTIONS') {header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');header('Access-Control-Max-Age: 600');http_response_code(204);exit;}
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') fail(405,'POST JSON required');
if ((int)($_SERVER['CONTENT_LENGTH']??0)>131072) fail(413,'Request too large');
$raw=file_get_contents('php://input',false,null,0,131073);
if ($raw===false||strlen($raw)>131072) fail(413,'Request too large');
$in=json_decode($raw,true,64);
if (!is_array($in)) fail(400,'JSON object expected');
$action=$in['action']??'';
if ($action==='health') { $h=health(); reply($h,$h['ok']?200:503); }
try {
    $db=db();
    limit($db,'ip:'.hash('sha256',$_SERVER['REMOTE_ADDR']??'local'),6000);
    $db->exec('BEGIN IMMEDIATE'); sweep($db);
    $now=time();
    if($action==='list') {
        limit($db,'directory:'.hash('sha256',$_SERVER['REMOTE_ADDR']??'local'),60);
        $rooms=run($db,"SELECT r.code,r.name,r.password,COUNT(p.id) AS players FROM rooms r JOIN peers p ON p.code=r.code WHERE r.visibility='public' GROUP BY r.code HAVING players<8 ORDER BY r.touched DESC LIMIT 30")->fetchAll();
        $out=['rooms'=>array_map(fn($r)=>['code'=>$r['code'],'name'=>$r['name'],'players'=>(int)$r['players'],'locked'=>$r['password']!==''],$rooms)];
    } elseif ($action==='create'||$action==='join') {
        limit($db,'lobby:'.hash('sha256',$_SERVER['REMOTE_ADDR']??'local'),30);
        $password=$in['password']??'';
        if(!is_string($password)||strlen($password)>64||str_contains($password,"\0"))fail(400,'Password must be at most 64 characters');
        $invite='';
        if ($action==='create') {
            $alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ';$code='';
            for($try=0;$try<20;$try++) {
                $code='';for($i=0;$i<6;$i++)$code.=$alphabet[random_int(0,23)];
                if(run($db,'INSERT OR IGNORE INTO rooms(code,host,created,touched) VALUES(?,0,?,?)',[$code,$now,$now])->rowCount())break;
                if($try===19)fail(503,'Please try creating the room again');
            }
            $visibility=($in['visibility']??'public')==='private'?'private':'public';
            $invite=$visibility==='private'?bin2hex(random_bytes(16)):'';
            run($db,'UPDATE rooms SET name=?,visibility=?,password=?,invite=? WHERE code=?',[clean_name($in['roomName']??'Harbor room'),$visibility,$password!==''?password_hash($password,PASSWORD_DEFAULT):'',$invite!==''?hash('sha256',$invite):'',$code]);
        } else {
            $code=clean_code($in['code']??'');
            $room=run($db,'SELECT code,visibility,password,invite FROM rooms WHERE code=?',[$code])->fetch();
            if(!$room)fail(404,'No room with that code or invite');
            if($room['visibility']==='private'&&(!is_string($in['invite']??null)||!hash_equals($room['invite'],hash('sha256',$in['invite']))))fail(404,'No room with that code or invite');
            if($room['password']!==''&&!password_verify($password,$room['password']))fail(401,'Password required or incorrect');
            if(count(peers($db,$code))>=HH_PEERS)fail(409,'Room is full (8 players)');
        }
        $token=bin2hex(random_bytes(16));
        run($db,'INSERT INTO peers(code,token,name,seen) VALUES(?,?,?,?)',[$code,hash('sha256',$token),clean_name($in['name']??''),$now]);
        $id=(int)$db->lastInsertId();
        if($action==='create')run($db,'UPDATE rooms SET host=? WHERE code=?',[$id,$code]);
        $host=(int)run($db,'SELECT host FROM rooms WHERE code=?',[$code])->fetchColumn();
        $out=['code'=>$code,'peer'=>$id,'token'=>$token,'host'=>$host,'peers'=>peers($db,$code),'invite'=>$invite];
    } else {
        $code=clean_code($in['code']??'');$me=auth($db,$code,$in['token']??null);$id=(int)$me['id'];
        limit($db,'peer:'.$id,600);
        $host=(int)run($db,'SELECT host FROM rooms WHERE code=?',[$code])->fetchColumn();
        $out=['ok'=>true];
        if($action==='signal') {
            $to=$in['to']??0;$kind=$in['kind']??'';$data=$in['data']??null;
            if(!is_int($to)||$to===$id||!run($db,'SELECT id FROM peers WHERE code=? AND id=?',[$code,$to])->fetch())fail(400,'Unknown room peer');
            if($id!==$host&&$to!==$host)fail(403,'Guests signal the host');
            if(!in_array($kind,['offer','answer','ice'],true)||!is_array($data))fail(400,'Invalid signal');
            if($kind!=='ice'&&(!isset($data['sdp'])||!is_string($data['sdp'])||($data['type']??'')!==$kind))fail(400,'Invalid session description');
            if($kind==='ice'&&(!isset($data['candidate'])||!is_string($data['candidate'])))fail(400,'Invalid ICE candidate');
            $json=json_encode($data);if(strlen($json)>24000)fail(413,'Signal too large');
            run($db,'INSERT INTO msgs(code,src,dst,kind,data,at) VALUES(?,?,?,?,?,?)',[$code,$id,$to,$kind,$json,$now]);
        } elseif($action==='poll'||$action==='exchange') {
            $packets=$in['packets']??[];
            if(!is_array($packets)||count($packets)>64)fail(400,'Too many relay packets');
            foreach($packets as $p) {
                if(!is_array($p)||!is_int($p['to']??null)||!in_array($p['label']??'',['state','event'],true)||!is_array($p['data']??null))fail(400,'Invalid relay packet');
                $to=$p['to'];$label=$p['label'];$data=$p['data'];
                if($to===$id||!run($db,'SELECT id FROM peers WHERE code=? AND id=?',[$code,$to])->fetch())continue;
                if($id!==$host&&$to!==$host)fail(403,'Guests relay through the host');
                if(($label==='state'?($data['id']??null):($data['from']??null))!==$id && $id!==$host)fail(403,'Peer identity mismatch');
                $json=json_encode($data);if(strlen($json)>12000)fail(413,'Relay packet too large');
                if($label==='event'&&in_array($data['k']??null,['ambient','world','transit','driveCar','damage'],true)
                    &&($id!==$host||($data['from']??null)!==$host))fail(403,'Host packet required');
                if($label==='event'&&($data['k']??null)==='ambient')
                    run($db,"DELETE FROM msgs WHERE code=? AND src=? AND dst=? AND kind='event' AND json_extract(data,'$.k')='ambient'",[$code,$id,$to]);
                if($label==='state'&&!is_int($data['id']??null))fail(400,'Invalid state identity');
                if($label==='state')run($db,"DELETE FROM msgs WHERE code=? AND src=? AND dst=? AND kind='state' AND json_extract(data,'$.id')=CAST(? AS INTEGER)",[$code,$id,$to,$data['id']]);
                run($db,'INSERT INTO msgs(code,src,dst,kind,data,at) VALUES(?,?,?,?,?,?)',[$code,$id,$to,$label,$json,$now]);
            }
            $since=$in['since']??0;if(!is_int($since)||$since<0)fail(400,'Invalid cursor');
            $messages=run($db,'SELECT id,src,kind,data FROM msgs WHERE code=? AND dst=? AND id>? ORDER BY id LIMIT 160',[$code,$id,$since])->fetchAll();
            $messages=array_map(fn($m)=>['id'=>(int)$m['id'],'from'=>(int)$m['src'],'kind'=>$m['kind'],'data'=>json_decode($m['data'],true)],$messages);
            $out=['messages'=>$messages,'peers'=>peers($db,$code),'host'=>$host,'now'=>microtime(true)*1000];
        } elseif($action==='ready') {
            if(!is_bool($in['ready']??null))fail(400,'Invalid ready state');run($db,'UPDATE peers SET ready=? WHERE id=?',[(int)$in['ready'],$id]);
        } elseif($action==='kick') {
            if($id!==$host)fail(403,'Only the host can remove a player');$target=$in['peer']??0;
            if(!is_int($target)||$target===$id)fail(400,'Invalid peer');run($db,'DELETE FROM peers WHERE code=? AND id=?',[$code,$target]);
        } elseif($action==='ice') {
            $ice=[['urls'=>'stun:stun.l.google.com:19302']];$cfg=config();
            if($cfg['turn_secret']&&$cfg['turn_urls']) {
                $username=(string)($now+600).':hh'.$id;
                $ice[]=['urls'=>$cfg['turn_urls'],'username'=>$username,'credential'=>base64_encode(hash_hmac('sha1',$username,$cfg['turn_secret'],true))];
            }
            $out=['iceServers'=>$ice];
        } elseif($action==='leave') {
            run($db,'DELETE FROM peers WHERE id=?',[$id]);sweep($db);
        } else fail(400,'Unknown action');
    }
    $db->exec('COMMIT');reply($out);
} catch(Throwable $e) {
    if(isset($db)&&$db->inTransaction())$db->rollBack();
    fail(503,'Room server unavailable; check setup.php');
}
