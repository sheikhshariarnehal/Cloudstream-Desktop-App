use crate::models::{RepositoryEntry, WatchHistoryItem, WatchlistItem};
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

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL
            );
            ",
        )?;

        // Safe migration for older tables
        let _ = conn.execute("ALTER TABLE repositories ADD COLUMN icon_url TEXT", []);
        let _ = conn.execute("ALTER TABLE repositories ADD COLUMN plugin_count INTEGER DEFAULT 0", []);

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
