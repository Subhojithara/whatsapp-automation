use std::env;
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub engine_data_dir: String,
    pub engine_script_path: String,
    pub api_key: Option<String>,
    pub engine_send_timeout_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .expect("PORT must be a valid u16 number");
        let database_url =
            env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:data/velurix.db".to_string());
        let raw_engine_dir = env::var("ENGINE_DATA_DIR").unwrap_or_else(|_| "apps/whatsapp-engine/data/sessions".to_string());
        let engine_data_dir = {
            let candidates = [
                raw_engine_dir.as_str(),
                "../whatsapp-engine/data/sessions",
                "apps/whatsapp-engine/data/sessions",
                "../../apps/whatsapp-engine/data/sessions",
            ];
            let mut resolved = raw_engine_dir.clone();
            for path in &candidates {
                if Path::new(path).exists() {
                    if let Ok(abs) = std::fs::canonicalize(path) {
                        resolved = abs.to_string_lossy().to_string().trim_start_matches(r"\\?\").to_string();
                        break;
                    }
                }
            }
            resolved
        };

        let api_key = env::var("API_KEY").ok().filter(|k| !k.trim().is_empty());

        let engine_send_timeout_secs = env::var("ENGINE_SEND_TIMEOUT_SECS")
            .unwrap_or_else(|_| "30".to_string())
            .parse::<u64>()
            .unwrap_or(30);

        let engine_script_path = env::var("ENGINE_SCRIPT_PATH").unwrap_or_else(|_| {
            let candidates = [
                "apps/whatsapp-engine/dist/index.js",
                "../whatsapp-engine/dist/index.js",
                "../../apps/whatsapp-engine/dist/index.js",
            ];
            for path in &candidates {
                if Path::new(path).exists() {
                    return path.to_string();
                }
            }
            "apps/whatsapp-engine/dist/index.js".to_string()
        });

        Config {
            host,
            port,
            database_url,
            engine_data_dir,
            engine_script_path,
            api_key,
            engine_send_timeout_secs,
        }
    }
}


