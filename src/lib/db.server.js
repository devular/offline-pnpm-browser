"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.getGeneratedPath = getGeneratedPath;
var node_sqlite_1 = require("node:sqlite");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var ROOT = process.cwd();
var DB_PATH = (0, node_path_1.resolve)(ROOT, 'packages.db');
var GENERATED = (0, node_path_1.resolve)(ROOT, 'generated');
var _db = null;
function getDb() {
    if (_db)
        return _db;
    if (!(0, node_fs_1.existsSync)(DB_PATH)) {
        throw new Error("Database not found at ".concat(DB_PATH, ". Run: pnpm run index"));
    }
    _db = new node_sqlite_1.DatabaseSync(DB_PATH, { readOnly: true });
    return _db;
}
function getGeneratedPath() {
    return GENERATED;
}
