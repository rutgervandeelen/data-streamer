const path = require("path");
const fs = require('fs');

const PROJECT_VOL = process.env.PROJECT_VOL || __dirname + '/uploads';
const STREAMER_UI_BUFFER_DIR = process.env.STREAMER_UI_BUFFER_DIR || __dirname + '/uploads';
const STREAMER_URL_PREFIX = process.env.STREAMER_URL_PREFIX || "http://streamer:3001";

// Get the project storage directory name
function _getProjectStorageDirName(projectNumber, subjectLabel, sessionLabel, dataType) {
    var projectStorageDirname;
    if (projectNumber && subjectLabel && sessionLabel && dataType) {
        var sub = 'sub-' + subjectLabel;
        var ses = 'ses-' + sessionLabel;
        projectStorageDirname = path.join(PROJECT_VOL, projectNumber, 'raw', sub, ses, dataType);
    }
    return projectStorageDirname;
}

// Get the streamer UI buffer directory name
function _getDirName(projectNumber, subjectLabel, sessionLabel, dataType) {
    var dirname;
    if (projectNumber && subjectLabel && sessionLabel && dataType) {
        var sub = 'sub-' + subjectLabel;
        var ses = 'ses-' + sessionLabel;
        dirname = path.join(STREAMER_UI_BUFFER_DIR, projectNumber, sub, ses, dataType);
    }
    return dirname;
}

// Derive the number of files
function _getNumFiles(files) {
    if (files[0]) {
        return files.length;
    } else {
        return 1;
    }
}

// Check if the file already exists
function _fileExists(filename, dirname) {
    var targetPath = path.join(dirname, filename);
    fs.accessSync(targetPath, fs.F_OK, (err) => {
        if (err) {
            // File does not exist
            return false;
        }
        // File exists
        return true;
    });
}

// Move the uploaded file from the temporary directory to the UI buffer
function _storeFile(file, dirname) {
    var targetPath = path.join(dirname, file.name);
    file.mv(targetPath, function (err) {
        if (err) {
            return err;
        } else {
            return null;
        }
    });
}

// Get the streamer URL
function _getStreamerUrl(projectNumber, subjectLabel, sessionLabel, dataType) {
    var url;
    if (projectNumber && subjectLabel && sessionLabel && dataType) {
        url = `${STREAMER_URL_PREFIX}/user/${projectNumber}/${subjectLabel}/${sessionLabel}/${dataType}`;
    }
    return url;
}

module.exports.getProjectStorageDirName = _getProjectStorageDirName;
module.exports.getDirName = _getDirName;
module.exports.getNumFiles = _getNumFiles;
module.exports.fileExists = _fileExists;
module.exports.storeFile = _storeFile;
module.exports.getStreamerUrl = _getStreamerUrl;