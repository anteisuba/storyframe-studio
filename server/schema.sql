CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (project_id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(project_id,revision));
CREATE TRIGGER IF NOT EXISTS archive_project BEFORE UPDATE ON projects BEGIN INSERT INTO revisions(project_id,revision,body) VALUES(old.id,old.revision,old.body); END;
