"use strict";

/**
 * Plugin API for PSD Time Machine
 *
 * Allows other plugins and scripts to extend functionality
 */

/**
 * Hook registry
 */
const hooks = {
    beforeSnapshot: [],
    afterSnapshot: [],
    beforeRestore: [],
    afterRestore: [],
    beforeDelete: [],
    afterDelete: [],
    onDiff: [],
    onExport: [],
    onImport: []
};

/**
 * Event emitter for plugin events
 */
class PluginEventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        for (const callback of callbacks) {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        }
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
}

const eventEmitter = new PluginEventEmitter();

/**
 * Registers a hook
 */
function registerHook(hookName, callback) {
    if (!hooks[hookName]) {
        throw new Error(`Unknown hook: ${hookName}`);
    }

    hooks[hookName].push(callback);

    return () => {
        // Return unregister function
        const index = hooks[hookName].indexOf(callback);
        if (index > -1) {
            hooks[hookName].splice(index, 1);
        }
    };
}

/**
 * Executes hooks
 */
async function executeHooks(hookName, data) {
    if (!hooks[hookName]) {
        return data;
    }

    let result = data;

    for (const callback of hooks[hookName]) {
        try {
            const hookResult = await callback(result);
            if (hookResult !== undefined) {
                result = hookResult;
            }
        } catch (error) {
            console.error(`Error in hook ${hookName}:`, error);
        }
    }

    return result;
}

/**
 * Plugin API class
 */
class PSDTimeMachineAPI {
    constructor() {
        this.version = "2.0.0";
        this.hooks = hooks;
        this.events = eventEmitter;
    }

    /**
     * Register a snapshot transformer
     * Allows plugins to modify snapshot data before saving
     */
    registerSnapshotTransformer(callback) {
        return registerHook('beforeSnapshot', callback);
    }

    /**
     * Register a restoration modifier
     * Allows plugins to modify data before restoration
     */
    registerRestorationModifier(callback) {
        return registerHook('beforeRestore', callback);
    }

    /**
     * Register a diff analyzer
     * Allows plugins to add custom diff analysis
     */
    registerDiffAnalyzer(callback) {
        return registerHook('onDiff', callback);
    }

    /**
     * Listen to plugin events
     */
    on(event, callback) {
        this.events.on(event, callback);
    }

    /**
     * Stop listening to events
     */
    off(event, callback) {
        this.events.off(event, callback);
    }

    /**
     * Emit custom event
     */
    emit(event, data) {
        this.events.emit(event, data);
    }

    /**
     * Get plugin version
     */
    getVersion() {
        return this.version;
    }

    /**
     * Get all registered hooks
     */
    getHooks() {
        return Object.keys(hooks);
    }
}

/**
 * API instance
 */
const api = new PSDTimeMachineAPI();

/**
 * Example plugin implementations
 */

/**
 * Example: Auto-tag snapshot with date
 */
function exampleAutoTagPlugin() {
    api.registerSnapshotTransformer((snapshot) => {
        const date = new Date().toLocaleDateString();
        if (!snapshot.tags) {
            snapshot.tags = [];
        }
        snapshot.tags.push(`date:${date}`);
        return snapshot;
    });
}

/**
 * Example: Log all snapshot operations
 */
function exampleLoggingPlugin() {
    api.on('snapshotCreated', (snapshot) => {
        console.log(`Snapshot created: ${snapshot.label}`);
    });

    api.on('snapshotRestored', (snapshot) => {
        console.log(`Snapshot restored: ${snapshot.label}`);
    });

    api.on('snapshotDeleted', (snapshotId) => {
        console.log(`Snapshot deleted: ${snapshotId}`);
    });
}

/**
 * Example: Validate snapshot data
 */
function exampleValidationPlugin() {
    api.registerSnapshotTransformer((snapshot) => {
        // Validate required fields
        if (!snapshot.label || snapshot.label.trim() === '') {
            throw new Error('Snapshot label is required');
        }

        if (!snapshot.layers || snapshot.layers.length === 0) {
            throw new Error('Snapshot must contain at least one layer');
        }

        return snapshot;
    });
}

/**
 * Example: Add custom metadata
 */
function exampleMetadataPlugin() {
    api.registerSnapshotTransformer((snapshot) => {
        snapshot.customMetadata = {
            createdBy: 'PSD Time Machine',
            appVersion: api.getVersion(),
            environment: 'production'
        };
        return snapshot;
    });
}

/**
 * Export API and utilities
 */
module.exports = {
    api,
    registerHook,
    executeHooks,
    eventEmitter,

    // Example plugins
    examples: {
        autoTag: exampleAutoTagPlugin,
        logging: exampleLoggingPlugin,
        validation: exampleValidationPlugin,
        metadata: exampleMetadataPlugin
    }
};

/**
 * Make API globally available
 */
if (typeof window !== 'undefined') {
    window.PSDTimeMachineAPI = api;
}
