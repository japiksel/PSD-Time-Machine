"use strict";

/**
 * Git Integration Module for PSD Time Machine
 *
 * Provides Git version control integration for snapshots
 */

const { shell } = require("uxp");

/**
 * Checks if Git is available in the system
 */
async function isGitAvailable() {
    try {
        // Note: UXP has limited shell access
        // This is a placeholder for Git integration
        // Actual implementation would require native module or external process
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Checks if current directory is a Git repository
 */
async function isGitRepository(path) {
    try {
        // Check for .git directory
        // Implementation would require file system access
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Commits snapshot file to Git
 */
async function commitSnapshot(snapshotLabel, psdPath) {
    try {
        if (!await isGitAvailable()) {
            throw new Error("Git is not available");
        }

        if (!await isGitRepository(psdPath)) {
            throw new Error("Not a Git repository");
        }

        // Git commands would be executed here
        // Example: git add *.psdtime.json
        // Example: git commit -m "Snapshot: ${snapshotLabel}"

        return {
            success: true,
            message: "Snapshot committed to Git"
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Creates a Git tag for a snapshot
 */
async function tagSnapshot(snapshotId, tagName) {
    try {
        if (!await isGitAvailable()) {
            throw new Error("Git is not available");
        }

        // Git tag command would be executed here
        // Example: git tag "snapshot-${snapshotId}" -m "${tagName}"

        return {
            success: true,
            message: `Git tag '${tagName}' created`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Pushes snapshot commits to remote
 */
async function pushToRemote(remoteName = "origin") {
    try {
        if (!await isGitAvailable()) {
            throw new Error("Git is not available");
        }

        // Git push command would be executed here
        // Example: git push origin main

        return {
            success: true,
            message: "Snapshots pushed to remote"
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Gets Git status for snapshot files
 */
async function getSnapshotFilesStatus(psdPath) {
    try {
        if (!await isGitAvailable()) {
            return null;
        }

        // Git status command would be executed here
        // Example: git status *.psdtime.json

        return {
            modified: [],
            untracked: [],
            staged: []
        };
    } catch (error) {
        return null;
    }
}

/**
 * Auto-commit snapshots if enabled in settings
 */
async function autoCommitSnapshot(snapshot, psdPath, settings) {
    if (!settings.gitIntegration || !settings.gitAutoCommit) {
        return false;
    }

    try {
        const result = await commitSnapshot(snapshot.label, psdPath);
        return result.success;
    } catch (error) {
        console.error("Auto-commit failed:", error);
        return false;
    }
}

module.exports = {
    isGitAvailable,
    isGitRepository,
    commitSnapshot,
    tagSnapshot,
    pushToRemote,
    getSnapshotFilesStatus,
    autoCommitSnapshot
};
