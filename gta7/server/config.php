<?php
/** Optional overrides only. The upload works without editing this file. Keep relay secrets here. */
return [
    'origin' => getenv('HH_ORIGIN') ?: '',
    'origins' => ['https://lowk.cooking', 'https://sandeepshenoy.dev'],
    'data_dir' => getenv('HH_DATA_DIR') ?: '',
    // Optional TURN REST credentials (coturn-compatible HMAC-SHA1). Never a browser secret.
    'turn_urls' => [],
    'turn_secret' => getenv('HH_TURN_SECRET') ?: '',
];
