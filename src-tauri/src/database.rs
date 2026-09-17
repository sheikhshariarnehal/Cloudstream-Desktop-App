use crate::models::{PluginManifest, RepositoryEntry, RepositoryManifest, SearchHistoryItem, WatchHistoryItem, WatchlistItem};
use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS watch_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                media_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                title TEXT NOT NULL,
                poster_url TEXT,
                episode_num INTEGER,
                season_num INTEGER,
                episode_name TEXT,
                position_ms INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                last_watched_at INTEGER NOT NULL,
                is_completed INTEGER DEFAULT 0,
                UNIQUE(media_id, episode_num, season_num)
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                media_id TEXT NOT NULL UNIQUE,
                provider_id TEXT NOT NULL,
                title TEXT NOT NULL,
                poster_url TEXT,
                tv_type TEXT NOT NULL,
                status TEXT NOT NULL,
                score REAL,
                added_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS repositories (
                url TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                icon_url TEXT,
                plugin_count INTEGER DEFAULT 0,
                added_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS installed_plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version INTEGER NOT NULL,
                repo_url TEXT NOT NULL,
                file_path TEXT NOT NULL,
                is_enabled INTEGER DEFAULT 1,
                installed_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                search_text TEXT NOT NULL,
                searched_at INTEGER NOT NULL,
                types TEXT NOT NULL,
                key TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                parent_id TEXT NOT NULL,
                url TEXT NOT NULL,
                source_api TEXT NOT NULL,
                media_title TEXT NOT NULL,
                episode_title TEXT,
                season_num INTEGER,
                episode_num INTEGER,
                tv_type TEXT NOT NULL,
                poster_url TEXT,
                file_path TEXT NOT NULL,
                total_bytes INTEGER DEFAULT 0,
                downloaded_bytes INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                error_message TEXT,
                headers_json TEXT,
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            );
            ",
        )?;

        // Safe migration for older tables
        let _ = conn.execute("ALTER TABLE repositories ADD COLUMN icon_url TEXT", []);
        let _ = conn.execute("ALTER TABLE repositories ADD COLUMN plugin_count INTEGER DEFAULT 0", []);
        // v2: persist custom request headers so resume can replay them
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN headers_json TEXT", []);

        Ok(())
    }

    pub fn save_watch_progress(&self, item: &WatchHistoryItem) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO watch_history (
                media_id, provider_id, title, poster_url, episode_num, season_num,
                episode_name, position_ms, duration_ms, last_watched_at, is_completed
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(media_id, episode_num, season_num) DO UPDATE SET
                position_ms = excluded.position_ms,
                duration_ms = excluded.duration_ms,
                last_watched_at = excluded.last_watched_at,
                is_completed = excluded.is_completed,
                poster_url = COALESCE(excluded.poster_url, watch_history.poster_url),
                title = excluded.title
            ",
            params![
                item.media_id,
                item.provider_id,
                item.title,
                item.poster_url,
                item.episode_num,
                item.season_num,
                item.episode_name,
                item.position_ms,
                item.duration_ms,
                item.last_watched_at,
                if item.is_completed { 1 } else { 0 },
            ],
        )?;
        Ok(())
    }

    pub fn get_watch_history(&self, limit: usize) -> Result<Vec<WatchHistoryItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, media_id, provider_id, title, poster_url, episode_num, season_num,
                    episode_name, position_ms, duration_ms, last_watched_at, is_completed
             FROM watch_history
             ORDER BY last_watched_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(WatchHistoryItem {
                id: Some(row.get(0)?),
                media_id: row.get(1)?,
                provider_id: row.get(2)?,
                title: row.get(3)?,
                poster_url: row.get(4)?,
                episode_num: row.get(5)?,
                season_num: row.get(6)?,
                episode_name: row.get(7)?,
                position_ms: row.get(8)?,
                duration_ms: row.get(9)?,
                last_watched_at: row.get(10)?,
                is_completed: row.get::<_, i64>(11)? == 1,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_progress_for_media(&self, media_id: &str) -> Result<Option<WatchHistoryItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, media_id, provider_id, title, poster_url, episode_num, season_num,
                    episode_name, position_ms, duration_ms, last_watched_at, is_completed
             FROM watch_history
             WHERE media_id = ?1
             ORDER BY last_watched_at DESC
             LIMIT 1",
        )?;
        let mut rows = stmt.query_map(params![media_id], |row| {
            Ok(WatchHistoryItem {
                id: Some(row.get(0)?),
                media_id: row.get(1)?,
                provider_id: row.get(2)?,
                title: row.get(3)?,
                poster_url: row.get(4)?,
                episode_num: row.get(5)?,
                season_num: row.get(6)?,
                episode_name: row.get(7)?,
                position_ms: row.get(8)?,
                duration_ms: row.get(9)?,
                last_watched_at: row.get(10)?,
                is_completed: row.get::<_, i64>(11)? == 1,
            })
        })?;

        if let Some(first) = rows.next() {
            Ok(Some(first?))
        } else {
            Ok(None)
        }
    }

    pub fn get_media_watch_history(&self, media_id: &str, title: Option<&str>) -> Result<Vec<WatchHistoryItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, media_id, provider_id, title, poster_url, episode_num, season_num,
                    episode_name, position_ms, duration_ms, last_watched_at, is_completed
             FROM watch_history
             WHERE media_id = ?1
                OR (?2 IS NOT NULL AND LOWER(title) = LOWER(?2))
             ORDER BY season_num ASC, episode_num ASC",
        )?;
        let rows = stmt.query_map(params![media_id, title], |row| {
            Ok(WatchHistoryItem {
                id: Some(row.get(0)?),
                media_id: row.get(1)?,
                provider_id: row.get(2)?,
                title: row.get(3)?,
                poster_url: row.get(4)?,
                episode_num: row.get(5)?,
                season_num: row.get(6)?,
                episode_name: row.get(7)?,
                position_ms: row.get(8)?,
                duration_ms: row.get(9)?,
                last_watched_at: row.get(10)?,
                is_completed: row.get::<_, i64>(11)? == 1,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_watchlist(&self) -> Result<Vec<WatchlistItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, media_id, provider_id, title, poster_url, tv_type, status, score, added_at
             FROM watchlist
             ORDER BY added_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(WatchlistItem {
                id: Some(row.get(0)?),
                media_id: row.get(1)?,
                provider_id: row.get(2)?,
                title: row.get(3)?,
                poster_url: row.get(4)?,
                tv_type: row.get(5)?,
                status: row.get(6)?,
                score: row.get(7)?,
                added_at: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn set_watchlist_item(&self, item: &WatchlistItem) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO watchlist (media_id, provider_id, title, poster_url, tv_type, status, score, added_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(media_id) DO UPDATE SET
                status = excluded.status,
                score = excluded.score,
                poster_url = COALESCE(excluded.poster_url, watchlist.poster_url)
            ",
            params![
                item.media_id,
                item.provider_id,
                item.title,
                item.poster_url,
                item.tv_type,
                item.status,
                item.score,
                item.added_at,
            ],
        )?;
        Ok(())
    }

    pub fn remove_from_watchlist(&self, media_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM watchlist WHERE media_id = ?1", params![media_id])?;
        Ok(())
    }

    pub fn clear_watch_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM watch_history", [])?;
        Ok(())
    }

    pub fn remove_watch_history_item(&self, media_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM watch_history WHERE media_id = ?1", params![media_id])?;
        Ok(())
    }

    pub fn save_repository(&self, repo: &RepositoryEntry, manifest_json: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO repositories (url, name, manifest_json, icon_url, plugin_count, added_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(url) DO UPDATE SET
                name = excluded.name,
                manifest_json = excluded.manifest_json,
                icon_url = excluded.icon_url,
                plugin_count = excluded.plugin_count,
                added_at = excluded.added_at
            ",
            params![
                repo.url,
                repo.name,
                manifest_json,
                repo.icon_url,
                repo.plugin_count as i64,
                repo.added_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_repositories(&self) -> Result<Vec<RepositoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT url, name, icon_url, plugin_count, added_at FROM repositories ORDER BY added_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let count: i64 = row.get(3).unwrap_or(0);
            Ok(RepositoryEntry {
                url: row.get(0)?,
                name: row.get(1)?,
                icon_url: row.get(2)?,
                manifest_version: Some(1),
                plugin_count: count as usize,
                added_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_repository(&self, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM repositories WHERE url = ?1", params![url])?;
        Ok(())
    }

    pub fn delete_all_repositories(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM repositories", [])?;
        Ok(())
    }

    pub fn get_repository_manifest_json(&self, url: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT manifest_json FROM repositories WHERE url = ?1")?;
        let mut rows = stmt.query_map(params![url], |row| row.get::<_, String>(0))?;
        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn get_all_repository_manifest_jsons(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT manifest_json FROM repositories")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut list = Vec::new();
        for r in rows {
            if let Ok(s) = r {
                list.push(s);
            }
        }
        Ok(list)
    }

    pub fn get_all_repository_plugins(&self) -> Result<Vec<PluginManifest>> {
        let jsons = self.get_all_repository_manifest_jsons()?;
        let mut all_plugins = Vec::new();
        for json_str in jsons {
            if let Ok(manifest) = serde_json::from_str::<RepositoryManifest>(&json_str) {
                all_plugins.extend(manifest.plugins);
            }
        }
        Ok(all_plugins)
    }

    pub fn add_search_history(&self, item: &SearchHistoryItem) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let types_json = serde_json::to_string(&item.types).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "
            INSERT INTO search_history (search_text, searched_at, types, key)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(key) DO UPDATE SET
                searched_at = excluded.searched_at,
                types = excluded.types;
            ",
            params![item.search_text, item.searched_at, types_json, item.key],
        )?;
        Ok(())
    }

    pub fn get_search_history(&self, limit: usize) -> Result<Vec<SearchHistoryItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, search_text, searched_at, types, key
            FROM search_history
            ORDER BY searched_at DESC
            LIMIT ?1
            ",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let id: i64 = row.get(0)?;
            let search_text: String = row.get(1)?;
            let searched_at: i64 = row.get(2)?;
            let types_str: String = row.get(3)?;
            let key: String = row.get(4)?;

            let types = serde_json::from_str(&types_str).unwrap_or_default();

            Ok(SearchHistoryItem {
                id: Some(id),
                search_text,
                searched_at,
                types,
                key,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn remove_search_history_item(&self, key: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM search_history WHERE key = ?1", params![key])?;
        Ok(())
    }

    pub fn clear_search_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM search_history", [])?;
        Ok(())
    }

    pub fn upsert_download(&self, item: &DownloadDbRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO downloads (
                id, parent_id, url, source_api, media_title, episode_title,
                season_num, episode_num, tv_type, poster_url, file_path,
                total_bytes, downloaded_bytes, status, error_message, headers_json,
                created_at, completed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            ON CONFLICT(id) DO UPDATE SET
                url = excluded.url,
                total_bytes = excluded.total_bytes,
                downloaded_bytes = excluded.downloaded_bytes,
                status = excluded.status,
                error_message = excluded.error_message,
                headers_json = COALESCE(excluded.headers_json, downloads.headers_json),
                completed_at = excluded.completed_at
            ",
            params![
                item.id,
                item.parent_id,
                item.url,
                item.source_api,
                item.media_title,
                item.episode_title,
                item.season_num,
                item.episode_num,
                item.tv_type,
                item.poster_url,
                item.file_path,
                item.total_bytes as i64,
                item.downloaded_bytes as i64,
                item.status,
                item.error_message,
                item.headers_json,
                item.created_at,
                item.completed_at
            ],
        )?;
        Ok(())
    }

    pub fn get_all_downloads(&self) -> Result<Vec<DownloadDbRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, url, source_api, media_title, episode_title,
                    season_num, episode_num, tv_type, poster_url, file_path,
                    total_bytes, downloaded_bytes, status, error_message, headers_json,
                    created_at, completed_at
             FROM downloads
             ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let total_bytes_raw: i64 = row.get(11)?;
            let downloaded_bytes_raw: i64 = row.get(12)?;

            Ok(DownloadDbRecord {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                url: row.get(2)?,
                source_api: row.get(3)?,
                media_title: row.get(4)?,
                episode_title: row.get(5)?,
                season_num: row.get(6)?,
                episode_num: row.get(7)?,
                tv_type: row.get(8)?,
                poster_url: row.get(9)?,
                file_path: row.get(10)?,
                total_bytes: total_bytes_raw.max(0) as u64,
                downloaded_bytes: downloaded_bytes_raw.max(0) as u64,
                status: row.get(13)?,
                error_message: row.get(14)?,
                headers_json: row.get(15)?,
                created_at: row.get(16)?,
                completed_at: row.get(17)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_download_by_id(&self, id: &str) -> Result<Option<DownloadDbRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, url, source_api, media_title, episode_title,
                    season_num, episode_num, tv_type, poster_url, file_path,
                    total_bytes, downloaded_bytes, status, error_message, headers_json,
                    created_at, completed_at
             FROM downloads
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            let total_bytes_raw: i64 = row.get(11)?;
            let downloaded_bytes_raw: i64 = row.get(12)?;

            Ok(DownloadDbRecord {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                url: row.get(2)?,
                source_api: row.get(3)?,
                media_title: row.get(4)?,
                episode_title: row.get(5)?,
                season_num: row.get(6)?,
                episode_num: row.get(7)?,
                tv_type: row.get(8)?,
                poster_url: row.get(9)?,
                file_path: row.get(10)?,
                total_bytes: total_bytes_raw.max(0) as u64,
                downloaded_bytes: downloaded_bytes_raw.max(0) as u64,
                status: row.get(13)?,
                error_message: row.get(14)?,
                headers_json: row.get(15)?,
                created_at: row.get(16)?,
                completed_at: row.get(17)?,
            })
        })?;

        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn update_download_progress(
        &self,
        id: &str,
        downloaded_bytes: u64,
        total_bytes: u64,
        status: &str,
        error_message: Option<&str>,
        completed_at: Option<i64>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads
             SET downloaded_bytes = ?1,
                 total_bytes = CASE WHEN ?2 > 0 THEN ?2 ELSE total_bytes END,
                 status = ?3,
                 error_message = ?4,
                 completed_at = COALESCE(?5, completed_at)
             WHERE id = ?6",
            params![
                downloaded_bytes as i64,
                total_bytes as i64,
                status,
                error_message,
                completed_at,
                id
            ],
        )?;
        Ok(())
    }

    pub fn delete_download(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_downloads_batch(&self, ids: &[String]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            let _ = conn.execute("DELETE FROM downloads WHERE id = ?1", params![id]);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadDbRecord {
    pub id: String,
    pub parent_id: String,
    pub url: String,
    pub source_api: String,
    pub media_title: String,
    pub episode_title: Option<String>,
    pub season_num: Option<i32>,
    pub episode_num: Option<i32>,
    pub tv_type: String,
    pub poster_url: Option<String>,
    pub file_path: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub status: String,
    pub error_message: Option<String>,
    /// JSON-serialised `HashMap<String, String>` of custom request headers.
    /// Stored so that resume can replay auth / referer headers.
    pub headers_json: Option<String>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_watch_progress() {
        let db = Database::in_memory().unwrap();

        let item = WatchHistoryItem {
            id: None,
            media_id: "test-movie-1".to_string(),
            provider_id: "NetMirror".to_string(),
            title: "Test Movie".to_string(),
            poster_url: Some("http://example.com/poster.jpg".to_string()),
            episode_num: None,
            season_num: None,
            episode_name: None,
            position_ms: 45000,
            duration_ms: 120000,
            last_watched_at: 1700000000,
            is_completed: false,
        };

        db.save_watch_progress(&item).unwrap();

        let fetched = db.get_progress_for_media("test-movie-1").unwrap();
        assert!(fetched.is_some());
        let f = fetched.unwrap();
        assert_eq!(f.title, "Test Movie");
        assert_eq!(f.position_ms, 45000);
        assert_eq!(f.duration_ms, 120000);

        let list = db.get_watch_history(10).unwrap();
        assert_eq!(list.len(), 1);
    }
}
