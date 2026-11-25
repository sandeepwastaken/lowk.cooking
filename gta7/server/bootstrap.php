<?php
declare(strict_types=1);
ini_set('display_errors', '0');
const HH_VERSION = 2;
const HH_PEERS = 8;
const HH_PEER_TTL = 45;
const HH_ROOM_TTL = 7200;
function config(): array { static $c; return $c ??= require __DIR__ . '/config.php'; }
function reply(array $data, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
function fail(int $status, string $message): never { reply(['error' => $message], $status); }
function storage(): string {
    if (config()['data_dir']) return config()['data_dir'];
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: dirname(__DIR__);
    // Keep the database outside public_html, including when the game is in a subfolder.
    $parent = dirname($root);
    if (is_writable($parent)) return $parent . '/.harbor-heat-' . substr(hash('sha256', __DIR__), 0, 16);
    return __DIR__ . '/data';
}
function db(): PDO {
    static $db; if ($db) return $db;
    if (PHP_VERSION_ID < 80100 || !extension_loaded('pdo_sqlite')) throw new RuntimeException('PHP 8.1+ and PDO SQLite required');
    $dir = storage();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Storage unavailable');
    if (!is_writable($dir)) throw new RuntimeException('Storage unavailable');
    if ($dir === __DIR__ . '/data' && !is_file($dir . '/.htaccess')) {
        if (@file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n") === false) throw new RuntimeException('Storage protection unavailable');
    }
    $db = new PDO('sqlite:' . $dir . '/rooms.sqlite', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    $db->exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host INTEGER, created INTEGER, touched INTEGER)');
    $roomCols=array_column($db->query('PRAGMA table_info(rooms)')->fetchAll(),'name');
    foreach(['name'=>"TEXT DEFAULT 'Harbor room'",'visibility'=>"TEXT DEFAULT 'public'",'password'=>"TEXT DEFAULT ''",'invite'=>"TEXT DEFAULT ''"] as $name=>$sql)if(!in_array($name,$roomCols,true))$db->exec('ALTER TABLE rooms ADD COLUMN '.$name.' '.$sql);
    $db->exec('CREATE TABLE IF NOT EXISTS peers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, token TEXT, name TEXT, seen INTEGER)');
    $db->exec('CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, src INTEGER, dst INTEGER, kind TEXT, data TEXT, at INTEGER)');
    $db->exec('CREATE INDEX IF NOT EXISTS msgs_dst ON msgs(code,dst,id)');
    $db->exec('CREATE TABLE IF NOT EXISTS hits (ip TEXT, minute INTEGER, n INTEGER, PRIMARY KEY(ip,minute))');
    return $db;
}
function health(): array {
    $php = PHP_VERSION_ID >= 80100; $sqlite = extension_loaded('pdo_sqlite'); $writable = false;
    if ($php && $sqlite) try { db(); $writable = true; } catch (Throwable $e) { /* Never reveal paths or exception text. */ }
    return ['ok'=>$php && $sqlite && $writable, 'version'=>HH_VERSION, 'checks'=>['php81'=>$php,'pdo_sqlite'=>$sqlite,'storage'=>$writable], 'transports'=>['webrtc','php-relay'], 'maxPeers'=>HH_PEERS];
}
function clean_name(mixed $name): string {
    $name = is_string($name) ? $name : 'Player';
    $name = preg_replace('/[^\p{L}\p{N} _-]/u', '', $name) ?? '';
    preg_match('/^.{0,20}/us', trim($name), $m);
    return ($m[0] ?? '') ?: 'Player';
}
function clean_code(mixed $code): string {
    $code = strtoupper(is_string($code)?$code:'');
    if (!preg_match('/^[A-HJ-NP-Z]{6}$/D', $code)) fail(400, 'Enter the six-letter room code'); return $code;
}
function run(PDO $db, string $sql, array $params=[]): PDOStatement { $q=$db->prepare($sql); $q->execute($params); return $q; }
function limit(PDO $db, string $key, int $max): void {
    $minute=intdiv(time(),60);
    run($db,'INSERT INTO hits(ip,minute,n) VALUES(?,?,1) ON CONFLICT(ip,minute) DO UPDATE SET n=n+1',[$key,$minute]);
    if ((int)run($db,'SELECT n FROM hits WHERE ip=? AND minute=?',[$key,$minute])->fetchColumn()>$max) fail(429,'Too many requests; try again shortly');
}
function sweep(PDO $db): void {
    $now=time();
    run($db,'DELETE FROM peers WHERE seen<?',[$now-HH_PEER_TTL]);
    run($db,'DELETE FROM rooms WHERE touched<? OR code NOT IN (SELECT code FROM peers)',[$now-HH_ROOM_TTL]);
    $db->exec('DELETE FROM peers WHERE code NOT IN (SELECT code FROM rooms)');
    run($db,'DELETE FROM msgs WHERE at<? OR code NOT IN (SELECT code FROM rooms)',[$now-120]);
    run($db,'DELETE FROM hits WHERE minute<?',[intdiv($now,60)-2]);
    // Repair hosts on timeout as well as explicit leave. Polling keeps active peers alive.
    $db->exec('UPDATE rooms SET host=(SELECT MIN(id) FROM peers WHERE peers.code=rooms.code) WHERE host NOT IN (SELECT id FROM peers)');
}
function peers(PDO $db,string $code): array {
    return array_map(fn($p)=>['id'=>(int)$p['id'],'name'=>$p['name']],run($db,'SELECT id,name FROM peers WHERE code=? ORDER BY id',[$code])->fetchAll());
}
function auth(PDO $db, string $code, mixed $token): array {
    if (!is_string($token)||!preg_match('/^[0-9a-f]{32}$/D',$token)) fail(401,'Invalid room session');
    $me=run($db,'SELECT id,name FROM peers WHERE code=? AND token=?',[$code,hash('sha256',$token)])->fetch();
    if (!$me) fail(404,'Room expired or you were removed; join again');
    run($db,'UPDATE peers SET seen=? WHERE id=?',[time(),$me['id']]);run($db,'UPDATE rooms SET touched=? WHERE code=?',[time(),$code]);
    return $me;
}
