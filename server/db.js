/* Opslag voor de Kledingkast-server.
   SQLite via node:sqlite — dat zit in Node zelf, dus er is niets te
   installeren en niets te onderhouden. Eén bestand op schijf; een back-up is
   een kopie van dat bestand. */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.KAST_DATA || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'kast.db'));

/* WAL houdt lezen en schrijven uit elkaars vaarwater; zonder dit staat de
   feed stil zodra iemand iets publiceert. */
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    handle      TEXT NOT NULL UNIQUE,
    naam        TEXT NOT NULL DEFAULT '',
    wachtwoord  TEXT NOT NULL,          -- scrypt: zout:hash
    created_at  INTEGER NOT NULL,
    geblokkeerd INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    laatst     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS looks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    naam        TEXT NOT NULL DEFAULT '',
    notitie     TEXT NOT NULL DEFAULT '',
    occasion    TEXT NOT NULL DEFAULT '',
    seasons     TEXT NOT NULL DEFAULT '',   -- kommagescheiden
    cover       TEXT,                        -- bestandsnaam in uploads/
    status      TEXT NOT NULL DEFAULT 'zichtbaar',
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS look_items (
    id        TEXT PRIMARY KEY,
    look_id   TEXT NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
    positie   INTEGER NOT NULL,
    naam      TEXT NOT NULL DEFAULT '',
    categorie TEXT NOT NULL DEFAULT 'overig',
    kleuren   TEXT NOT NULL DEFAULT '',
    merk      TEXT NOT NULL DEFAULT '',
    link      TEXT NOT NULL DEFAULT '',
    foto      TEXT
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    look_id    TEXT NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, look_id)
  );

  CREATE TABLE IF NOT EXISTS saves (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    look_id    TEXT NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, look_id)
  );

  CREATE TABLE IF NOT EXISTS meldingen (
    id           TEXT PRIMARY KEY,
    look_id      TEXT NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reden        TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL,
    afgehandeld  INTEGER NOT NULL DEFAULT 0
  );

  /* Een back-up van iemands eigen kast, zodat een nieuwe telefoon niet leeg
     begint. Eén rij per gebruiker; de inhoud is versleuteld noch gelezen door
     de server — het is gewoon het exportbestand dat de app al maakte. */
  CREATE TABLE IF NOT EXISTS kast_backups (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    inhoud     BLOB NOT NULL,
    bytes      INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feed  ON looks(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_likes ON likes(look_id);
  CREATE INDEX IF NOT EXISTS idx_saves ON saves(look_id);
  CREATE INDEX IF NOT EXISTS idx_mijn  ON looks(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items ON look_items(look_id, positie);
`);

module.exports = { db, DATA_DIR, UPLOAD_DIR };
