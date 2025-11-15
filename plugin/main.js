"use strict";

/**
 * PSD Time Machine - UXP Plugin for Photoshop
 * Version: 1.0.0
 *
 * This plugin allows users to create snapshots of layer metadata,
 * store them externally, and restore/compare them later.
 */

// Photoshop UXP APIs
const { app, core, action } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { entrypoints } = require("uxp");

// Global state
let currentDocument = null;
let snapshots = [];
let confirmCallback = null;

// Constants
const TIME_MACHINE_VERSION = "1.0";
const FILE_SUFFIX = ".psdtime.json";

/**
 * =============================================================================
 * UTILITY FUNCTIONS
 * =============================================================================
 */

/**
 * Shows an error alert to the user
 * @param {string} message - Error message to display
 */
async function showError(message) {
    await showAlert("Error", message);
}

/**
 * Shows a success alert to the user
 * @param {string} message - Success message to display
 */
async function showSuccess(message) {
    await showAlert("Success", message);
}

/**
 * Shows a generic alert dialog
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 */
async function showAlert(title, message) {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
        <form method="dialog" style="padding: 20px; min-width: 250px;">
            <h3 style="margin-bottom: 12px; font-size: 16px;">${title}</h3>
            <p style="margin-bottom: 16px; font-size: 13px;">${message}</p>
            <div style="display: flex; justify-content: flex-end;">
                <sp-button variant="cta">OK</sp-button>
            </div>
        </form>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    await new Promise(resolve => {
        dialog.addEventListener("close", () => {
            document.body.removeChild(dialog);
            resolve();
        });
    });
}

/**
 * Formats a date for display
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
}

/**
 * Generates a snapshot ID based on current timestamp
 * @returns {string} Snapshot ID
 */
function generateSnapshotId() {
    const now = new Date();
    return now.toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
}

/**
 * =============================================================================
 * DOCUMENT METADATA FUNCTIONS
 * =============================================================================
 */

/**
 * Gets the active document metadata
 * @returns {Object|null} Document metadata or null if no document is open
 */
async function getDocumentMetadata() {
    try {
        const doc = app.activeDocument;
        if (!doc) {
            return null;
        }

        return {
            name: doc.name,
            path: doc.path,
            width: doc.width,
            height: doc.height,
            resolution: doc.resolution
        };
    } catch (error) {
        console.error("Error getting document metadata:", error);
        return null;
    }
}

/**
 * =============================================================================
 * LAYER METADATA COLLECTION
 * =============================================================================
 */

/**
 * Collects metadata from a single layer
 * @param {Layer} layer - Photoshop layer object
 * @param {string} parentPath - Path to parent group
 * @returns {Object} Layer metadata object
 */
async function collectLayerMetadata(layer, parentPath = "") {
    const layerPath = parentPath ? `${parentPath}/${layer.name}` : layer.name;

    const metadata = {
        layerId: layer.id,
        path: layerPath,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode || "normal",
        bounds: null,
        kind: layer.kind,
        text: null,
        smartObject: null,
        effects: {}
    };

    // Get bounds (position)
    try {
        if (layer.bounds) {
            metadata.bounds = [
                Math.round(layer.bounds.left),
                Math.round(layer.bounds.top),
                Math.round(layer.bounds.right),
                Math.round(layer.bounds.bottom)
            ];
        }
    } catch (error) {
        console.warn(`Could not get bounds for layer ${layer.name}:`, error);
    }

    // Get text content for text layers
    if (layer.kind === "text") {
        try {
            // Access text content through textItem
            if (layer.textItem) {
                metadata.text = {
                    contents: layer.textItem.contents || "",
                    fontSize: layer.textItem.size || null,
                    font: layer.textItem.font || null,
                    color: layer.textItem.color ? {
                        red: layer.textItem.color.red || 0,
                        green: layer.textItem.color.green || 0,
                        blue: layer.textItem.color.blue || 0
                    } : null
                };
            }
        } catch (error) {
            console.warn(`Could not get text content for layer ${layer.name}:`, error);
        }
    }

    // Get smart object info
    if (layer.kind === "smartObject") {
        try {
            metadata.smartObject = {
                linked: false // Default value, full detection would require batchPlay
            };
        } catch (error) {
            console.warn(`Could not get smart object info for layer ${layer.name}:`, error);
        }
    }

    // Get layer effects info (simplified)
    try {
        // Note: Full effects detection would require batchPlay API
        // This is a placeholder structure
        metadata.effects = {
            dropShadow: false,
            stroke: false,
            innerShadow: false,
            outerGlow: false,
            innerGlow: false
        };
    } catch (error) {
        console.warn(`Could not get effects for layer ${layer.name}:`, error);
    }

    return metadata;
}

/**
 * Recursively collects metadata from all layers in a group or document
 * @param {LayersCollection} layers - Collection of layers to process
 * @param {string} parentPath - Path to parent group
 * @returns {Array} Array of layer metadata objects
 */
async function collectAllLayersMetadata(layers, parentPath = "") {
    const allMetadata = [];

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];

        // Collect metadata for this layer
        const metadata = await collectLayerMetadata(layer, parentPath);
        allMetadata.push(metadata);

        // If this is a group, recursively process its children
        if (layer.kind === "group" && layer.layers && layer.layers.length > 0) {
            const childMetadata = await collectAllLayersMetadata(
                layer.layers,
                metadata.path
            );
            allMetadata.push(...childMetadata);
        }
    }

    return allMetadata;
}

/**
 * =============================================================================
 * FILE I/O OPERATIONS
 * =============================================================================
 */

/**
 * Gets the time machine file path for the current document
 * @param {string} psdPath - Path to the PSD file
 * @returns {string} Path to the time machine JSON file
 */
function getTimeMachineFilePath(psdPath) {
    // Remove .psd extension and add .psdtime.json
    const basePath = psdPath.replace(/\.psd$/i, "");
    return `${basePath}${FILE_SUFFIX}`;
}

/**
 * Reads the time machine file
 * @param {string} psdPath - Path to the PSD file
 * @returns {Object|null} Time machine data or null if file doesn't exist
 */
async function readTimeMachineFile(psdPath) {
    try {
        const folder = await localFileSystem.getFolder(psdPath.substring(0, psdPath.lastIndexOf("/")));
        const fileName = getTimeMachineFilePath(psdPath).split("/").pop();

        try {
            const file = await folder.getEntry(fileName);
            const contents = await file.read();
            return JSON.parse(contents);
        } catch (error) {
            // File doesn't exist - return null
            return null;
        }
    } catch (error) {
        console.error("Error reading time machine file:", error);
        return null;
    }
}

/**
 * Writes the time machine file
 * @param {string} psdPath - Path to the PSD file
 * @param {Object} data - Data to write
 * @returns {boolean} True if successful, false otherwise
 */
async function writeTimeMachineFile(psdPath, data) {
    try {
        const folderPath = psdPath.substring(0, psdPath.lastIndexOf("/"));
        const folder = await localFileSystem.getFolder(folderPath);
        const fileName = getTimeMachineFilePath(psdPath).split("/").pop();

        const file = await folder.createFile(fileName, { overwrite: true });
        await file.write(JSON.stringify(data, null, 2));

        return true;
    } catch (error) {
        console.error("Error writing time machine file:", error);
        await showError(`Failed to save snapshot file: ${error.message}`);
        return false;
    }
}

/**
 * =============================================================================
 * SNAPSHOT OPERATIONS
 * =============================================================================
 */

/**
 * Creates a new snapshot of the current document
 * @param {string} label - Snapshot label
 * @param {string} note - Snapshot note/comment
 * @returns {boolean} True if successful, false otherwise
 */
async function createSnapshot(label, note) {
    try {
        // Check if document is open
        const doc = app.activeDocument;
        if (!doc) {
            await showError("No document is currently open.");
            return false;
        }

        // Check if document has been saved
        if (!doc.path) {
            await showError("Please save the document before creating a snapshot.");
            return false;
        }

        // Collect all layer metadata
        const layersMetadata = await collectAllLayersMetadata(doc.layers);

        // Create snapshot object
        const snapshot = {
            id: generateSnapshotId(),
            label: label,
            note: note || "",
            createdAt: new Date().toISOString(),
            layers: layersMetadata
        };

        // Read existing time machine file or create new structure
        let timeMachineData = await readTimeMachineFile(doc.path);

        if (!timeMachineData) {
            timeMachineData = {
                documentName: doc.name,
                version: TIME_MACHINE_VERSION,
                snapshots: []
            };
        }

        // Add new snapshot
        timeMachineData.snapshots.push(snapshot);

        // Write to file
        const success = await writeTimeMachineFile(doc.path, timeMachineData);

        if (success) {
            await showSuccess(`Snapshot "${label}" created successfully!`);
            await loadSnapshotList();
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error creating snapshot:", error);
        await showError(`Failed to create snapshot: ${error.message}`);
        return false;
    }
}

/**
 * Finds a layer in the document by ID or path+name
 * @param {Document} doc - Photoshop document
 * @param {Object} layerMetadata - Layer metadata to find
 * @returns {Layer|null} Found layer or null
 */
async function findLayer(doc, layerMetadata) {
    // Helper function to search recursively
    function searchLayers(layers, targetId, targetPath, targetName) {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            // Try to match by ID first
            if (layer.id === targetId) {
                return layer;
            }

            // Try to match by name if ID doesn't match
            if (layer.name === targetName) {
                return layer;
            }

            // Recursively search in groups
            if (layer.kind === "group" && layer.layers && layer.layers.length > 0) {
                const found = searchLayers(layer.layers, targetId, targetPath, targetName);
                if (found) return found;
            }
        }
        return null;
    }

    return searchLayers(doc.layers, layerMetadata.layerId, layerMetadata.path, layerMetadata.name);
}

/**
 * Restores a snapshot by ID
 * @param {string} snapshotId - ID of snapshot to restore
 * @returns {boolean} True if successful, false otherwise
 */
async function restoreSnapshot(snapshotId) {
    try {
        const doc = app.activeDocument;
        if (!doc) {
            await showError("No document is currently open.");
            return false;
        }

        if (!doc.path) {
            await showError("Document must be saved to restore a snapshot.");
            return false;
        }

        // Load time machine file
        const timeMachineData = await readTimeMachineFile(doc.path);
        if (!timeMachineData) {
            await showError("No snapshots file found for this document.");
            return false;
        }

        // Find snapshot
        const snapshot = timeMachineData.snapshots.find(s => s.id === snapshotId);
        if (!snapshot) {
            await showError("Snapshot not found.");
            return false;
        }

        // Verify document name matches
        if (timeMachineData.documentName !== doc.name) {
            await showError("This snapshot belongs to a different document.");
            return false;
        }

        // Execute restoration using batchPlay for better control
        await core.executeAsModal(async () => {
            let restoredCount = 0;
            let skippedCount = 0;

            // Restore each layer
            for (const layerMeta of snapshot.layers) {
                try {
                    const layer = await findLayer(doc, layerMeta);

                    if (!layer) {
                        console.warn(`Layer not found: ${layerMeta.path}`);
                        skippedCount++;
                        continue;
                    }

                    // Restore basic properties
                    layer.visible = layerMeta.visible;
                    layer.opacity = layerMeta.opacity;

                    // Note: blendMode restoration may require batchPlay for full compatibility
                    try {
                        layer.blendMode = layerMeta.blendMode;
                    } catch (e) {
                        console.warn(`Could not restore blend mode for ${layer.name}`);
                    }

                    // Restore text content
                    if (layerMeta.text && layer.kind === "text" && layer.textItem) {
                        try {
                            layer.textItem.contents = layerMeta.text.contents;
                        } catch (e) {
                            console.warn(`Could not restore text for ${layer.name}:`, e);
                        }
                    }

                    // Note: Position/bounds restoration would require batchPlay for pixel-perfect accuracy
                    // as the Layer API doesn't provide direct positioning methods

                    restoredCount++;
                } catch (error) {
                    console.error(`Error restoring layer ${layerMeta.path}:`, error);
                    skippedCount++;
                }
            }

            await showSuccess(
                `Snapshot "${snapshot.label}" restored!\n` +
                `${restoredCount} layers updated, ${skippedCount} skipped.`
            );
        }, { commandName: "Restore Snapshot" });

        return true;
    } catch (error) {
        console.error("Error restoring snapshot:", error);
        await showError(`Failed to restore snapshot: ${error.message}`);
        return false;
    }
}

/**
 * Compares current document state with a snapshot
 * @param {string} snapshotId - ID of snapshot to compare
 * @returns {Object|null} Diff results or null if failed
 */
async function diffSnapshot(snapshotId) {
    try {
        const doc = app.activeDocument;
        if (!doc) {
            await showError("No document is currently open.");
            return null;
        }

        if (!doc.path) {
            await showError("Document must be saved to compare with a snapshot.");
            return null;
        }

        // Load time machine file
        const timeMachineData = await readTimeMachineFile(doc.path);
        if (!timeMachineData) {
            await showError("No snapshots file found for this document.");
            return null;
        }

        // Find snapshot
        const snapshot = timeMachineData.snapshots.find(s => s.id === snapshotId);
        if (!snapshot) {
            await showError("Snapshot not found.");
            return null;
        }

        // Collect current state
        const currentLayers = await collectAllLayersMetadata(doc.layers);

        // Compare and build diff
        const diff = {
            textChanges: [],
            positionChanges: [],
            visibilityChanges: [],
            opacityChanges: [],
            blendModeChanges: [],
            addedLayers: [],
            removedLayers: []
        };

        // Create maps for easier lookup
        const currentLayersMap = new Map();
        currentLayers.forEach(l => {
            currentLayersMap.set(l.layerId, l);
            currentLayersMap.set(l.path, l);
        });

        const snapshotLayersMap = new Map();
        snapshot.layers.forEach(l => {
            snapshotLayersMap.set(l.layerId, l);
            snapshotLayersMap.set(l.path, l);
        });

        // Find changes in existing layers
        for (const snapLayer of snapshot.layers) {
            const currentLayer = currentLayersMap.get(snapLayer.layerId) ||
                               currentLayersMap.get(snapLayer.path);

            if (!currentLayer) {
                diff.removedLayers.push(snapLayer);
                continue;
            }

            // Check text changes
            if (snapLayer.text && currentLayer.text) {
                if (snapLayer.text.contents !== currentLayer.text.contents) {
                    diff.textChanges.push({
                        layer: snapLayer.path,
                        old: snapLayer.text.contents,
                        new: currentLayer.text.contents
                    });
                }
            }

            // Check position changes
            if (snapLayer.bounds && currentLayer.bounds) {
                const boundsChanged =
                    snapLayer.bounds[0] !== currentLayer.bounds[0] ||
                    snapLayer.bounds[1] !== currentLayer.bounds[1] ||
                    snapLayer.bounds[2] !== currentLayer.bounds[2] ||
                    snapLayer.bounds[3] !== currentLayer.bounds[3];

                if (boundsChanged) {
                    diff.positionChanges.push({
                        layer: snapLayer.path,
                        old: snapLayer.bounds,
                        new: currentLayer.bounds
                    });
                }
            }

            // Check visibility changes
            if (snapLayer.visible !== currentLayer.visible) {
                diff.visibilityChanges.push({
                    layer: snapLayer.path,
                    old: snapLayer.visible,
                    new: currentLayer.visible
                });
            }

            // Check opacity changes
            if (snapLayer.opacity !== currentLayer.opacity) {
                diff.opacityChanges.push({
                    layer: snapLayer.path,
                    old: snapLayer.opacity,
                    new: currentLayer.opacity
                });
            }

            // Check blend mode changes
            if (snapLayer.blendMode !== currentLayer.blendMode) {
                diff.blendModeChanges.push({
                    layer: snapLayer.path,
                    old: snapLayer.blendMode,
                    new: currentLayer.blendMode
                });
            }
        }

        // Find added layers
        for (const currentLayer of currentLayers) {
            const snapLayer = snapshotLayersMap.get(currentLayer.layerId) ||
                            snapshotLayersMap.get(currentLayer.path);

            if (!snapLayer) {
                diff.addedLayers.push(currentLayer);
            }
        }

        return diff;
    } catch (error) {
        console.error("Error diffing snapshot:", error);
        await showError(`Failed to compare with snapshot: ${error.message}`);
        return null;
    }
}

/**
 * Deletes a snapshot by ID
 * @param {string} snapshotId - ID of snapshot to delete
 * @returns {boolean} True if successful, false otherwise
 */
async function deleteSnapshot(snapshotId) {
    try {
        const doc = app.activeDocument;
        if (!doc) {
            await showError("No document is currently open.");
            return false;
        }

        if (!doc.path) {
            await showError("Document must be saved.");
            return false;
        }

        // Load time machine file
        const timeMachineData = await readTimeMachineFile(doc.path);
        if (!timeMachineData) {
            await showError("No snapshots file found.");
            return false;
        }

        // Remove snapshot
        const originalLength = timeMachineData.snapshots.length;
        timeMachineData.snapshots = timeMachineData.snapshots.filter(
            s => s.id !== snapshotId
        );

        if (timeMachineData.snapshots.length === originalLength) {
            await showError("Snapshot not found.");
            return false;
        }

        // Write updated file
        const success = await writeTimeMachineFile(doc.path, timeMachineData);

        if (success) {
            await showSuccess("Snapshot deleted successfully!");
            await loadSnapshotList();
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error deleting snapshot:", error);
        await showError(`Failed to delete snapshot: ${error.message}`);
        return false;
    }
}

/**
 * Loads and displays the list of snapshots
 */
async function loadSnapshotList() {
    try {
        const doc = app.activeDocument;

        // Update document name display
        const docNameEl = document.getElementById("documentName");
        if (!doc) {
            docNameEl.textContent = "No document open";
            document.getElementById("snapshotsList").innerHTML = "";
            document.getElementById("emptyState").classList.remove("hidden");
            return;
        }

        docNameEl.textContent = doc.name;

        // Load snapshots from file
        if (!doc.path) {
            document.getElementById("snapshotsList").innerHTML = "";
            document.getElementById("emptyState").classList.remove("hidden");
            return;
        }

        const timeMachineData = await readTimeMachineFile(doc.path);

        if (!timeMachineData || timeMachineData.snapshots.length === 0) {
            document.getElementById("snapshotsList").innerHTML = "";
            document.getElementById("emptyState").classList.remove("hidden");
            return;
        }

        // Sort snapshots by creation date (newest first)
        const sortedSnapshots = [...timeMachineData.snapshots].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        // Render snapshots
        const listEl = document.getElementById("snapshotsList");
        listEl.innerHTML = "";
        document.getElementById("emptyState").classList.add("hidden");

        for (const snapshot of sortedSnapshots) {
            const card = createSnapshotCard(snapshot);
            listEl.appendChild(card);
        }
    } catch (error) {
        console.error("Error loading snapshot list:", error);
    }
}

/**
 * Creates a snapshot card element
 * @param {Object} snapshot - Snapshot data
 * @returns {HTMLElement} Snapshot card element
 */
function createSnapshotCard(snapshot) {
    const card = document.createElement("div");
    card.className = "snapshot-card";

    const noteHtml = snapshot.note
        ? `<div class="snapshot-note">${escapeHtml(snapshot.note)}</div>`
        : "";

    card.innerHTML = `
        <div class="snapshot-header">
            <div class="snapshot-info">
                <div class="snapshot-label">${escapeHtml(snapshot.label)}</div>
                <div class="snapshot-time">${formatDate(snapshot.createdAt)}</div>
                <div class="snapshot-id">${snapshot.id}</div>
            </div>
        </div>
        ${noteHtml}
        <div class="snapshot-actions">
            <sp-button variant="primary" size="s" class="restore-btn" data-id="${snapshot.id}">
                Restore
            </sp-button>
            <sp-button variant="secondary" size="s" class="diff-btn" data-id="${snapshot.id}">
                Diff
            </sp-button>
            <sp-button variant="secondary" size="s" class="delete-btn" data-id="${snapshot.id}">
                Delete
            </sp-button>
        </div>
    `;

    // Add event listeners
    card.querySelector(".restore-btn").addEventListener("click", (e) => {
        handleRestoreSnapshot(e.target.dataset.id);
    });

    card.querySelector(".diff-btn").addEventListener("click", (e) => {
        handleDiffSnapshot(e.target.dataset.id);
    });

    card.querySelector(".delete-btn").addEventListener("click", (e) => {
        handleDeleteSnapshot(e.target.dataset.id);
    });

    return card;
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * =============================================================================
 * EVENT HANDLERS
 * =============================================================================
 */

/**
 * Handles create snapshot button click
 */
async function handleCreateSnapshot() {
    try {
        const doc = app.activeDocument;
        if (!doc) {
            await showError("No document is currently open.");
            return;
        }

        if (!doc.path) {
            await showError("Please save the document before creating a snapshot.");
            return;
        }

        // Show modal
        const modal = document.getElementById("createSnapshotModal");
        const labelInput = document.getElementById("snapshotLabel");
        const noteInput = document.getElementById("snapshotNote");

        // Clear previous values
        labelInput.value = "";
        noteInput.value = "";

        modal.showModal();
    } catch (error) {
        console.error("Error opening create snapshot modal:", error);
        await showError(`Error: ${error.message}`);
    }
}

/**
 * Handles snapshot creation confirmation
 */
async function handleConfirmCreateSnapshot() {
    const labelInput = document.getElementById("snapshotLabel");
    const noteInput = document.getElementById("snapshotNote");
    const modal = document.getElementById("createSnapshotModal");

    const label = labelInput.value.trim();

    if (!label) {
        await showError("Please enter a label for the snapshot.");
        return;
    }

    const note = noteInput.value.trim();

    // Close modal
    modal.close();

    // Create snapshot
    await createSnapshot(label, note);
}

/**
 * Handles restore snapshot action
 * @param {string} snapshotId - Snapshot ID to restore
 */
async function handleRestoreSnapshot(snapshotId) {
    showConfirmDialog(
        "Restore Snapshot",
        "Are you sure you want to restore this snapshot? This will modify the current document layers.",
        async () => {
            await restoreSnapshot(snapshotId);
        }
    );
}

/**
 * Handles diff snapshot action
 * @param {string} snapshotId - Snapshot ID to compare
 */
async function handleDiffSnapshot(snapshotId) {
    const diff = await diffSnapshot(snapshotId);

    if (!diff) {
        return;
    }

    // Display diff in modal
    const modal = document.getElementById("diffModal");
    const content = document.getElementById("diffContent");

    let html = "";

    // Helper to check if any changes exist
    const hasChanges =
        diff.textChanges.length > 0 ||
        diff.positionChanges.length > 0 ||
        diff.visibilityChanges.length > 0 ||
        diff.opacityChanges.length > 0 ||
        diff.blendModeChanges.length > 0 ||
        diff.addedLayers.length > 0 ||
        diff.removedLayers.length > 0;

    if (!hasChanges) {
        html = '<div class="no-changes">No changes detected between snapshot and current state.</div>';
    } else {
        // Text changes
        if (diff.textChanges.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Text Changes</div>';
            for (const change of diff.textChanges) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(change.layer)}</div>
                        <div class="diff-change">
                            <div class="diff-label">Old:</div>
                            <div class="diff-old">${escapeHtml(change.old)}</div>
                            <div class="diff-label">New:</div>
                            <div class="diff-new">${escapeHtml(change.new)}</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Position changes
        if (diff.positionChanges.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Position Changes</div>';
            for (const change of diff.positionChanges) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(change.layer)}</div>
                        <div class="diff-change">
                            <div class="diff-label">Old bounds:</div>
                            <div class="diff-old">[${change.old.join(", ")}]</div>
                            <div class="diff-label">New bounds:</div>
                            <div class="diff-new">[${change.new.join(", ")}]</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Visibility changes
        if (diff.visibilityChanges.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Visibility Changes</div>';
            for (const change of diff.visibilityChanges) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(change.layer)}</div>
                        <div class="diff-change">
                            <div class="diff-old">${change.old ? "Visible" : "Hidden"}</div>
                            <div class="diff-new">${change.new ? "Visible" : "Hidden"}</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Opacity changes
        if (diff.opacityChanges.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Opacity Changes</div>';
            for (const change of diff.opacityChanges) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(change.layer)}</div>
                        <div class="diff-change">
                            <div class="diff-old">${change.old}%</div>
                            <div class="diff-new">${change.new}%</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Blend mode changes
        if (diff.blendModeChanges.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Blend Mode Changes</div>';
            for (const change of diff.blendModeChanges) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(change.layer)}</div>
                        <div class="diff-change">
                            <div class="diff-old">${escapeHtml(change.old)}</div>
                            <div class="diff-new">${escapeHtml(change.new)}</div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Added layers
        if (diff.addedLayers.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Added Layers</div>';
            for (const layer of diff.addedLayers) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(layer.path)}</div>
                    </div>
                `;
            }
            html += '</div>';
        }

        // Removed layers
        if (diff.removedLayers.length > 0) {
            html += '<div class="diff-section">';
            html += '<div class="diff-section-title">Removed Layers</div>';
            for (const layer of diff.removedLayers) {
                html += `
                    <div class="diff-item">
                        <div class="diff-layer-name">${escapeHtml(layer.path)}</div>
                    </div>
                `;
            }
            html += '</div>';
        }
    }

    content.innerHTML = html;
    modal.showModal();
}

/**
 * Handles delete snapshot action
 * @param {string} snapshotId - Snapshot ID to delete
 */
async function handleDeleteSnapshot(snapshotId) {
    showConfirmDialog(
        "Delete Snapshot",
        "Are you sure you want to delete this snapshot? This action cannot be undone.",
        async () => {
            await deleteSnapshot(snapshotId);
        }
    );
}

/**
 * Shows a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {Function} callback - Callback to execute on confirmation
 */
function showConfirmDialog(title, message, callback) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");

    titleEl.textContent = title;
    messageEl.textContent = message;

    confirmCallback = callback;

    modal.showModal();
}

/**
 * =============================================================================
 * UI INITIALIZATION
 * =============================================================================
 */

/**
 * Builds and initializes the UI
 */
function buildUI() {
    // Create Snapshot button
    document.getElementById("createSnapshotBtn").addEventListener("click", handleCreateSnapshot);

    // Refresh button
    document.getElementById("refreshBtn").addEventListener("click", loadSnapshotList);

    // Create Snapshot Modal
    document.getElementById("cancelSnapshotBtn").addEventListener("click", () => {
        document.getElementById("createSnapshotModal").close();
    });

    document.getElementById("confirmSnapshotBtn").addEventListener("click", handleConfirmCreateSnapshot);

    // Diff Modal
    document.getElementById("closeDiffBtn").addEventListener("click", () => {
        document.getElementById("diffModal").close();
    });

    document.getElementById("closeDiffBottomBtn").addEventListener("click", () => {
        document.getElementById("diffModal").close();
    });

    // Confirm Modal
    document.getElementById("cancelConfirmBtn").addEventListener("click", () => {
        document.getElementById("confirmModal").close();
        confirmCallback = null;
    });

    document.getElementById("confirmActionBtn").addEventListener("click", async () => {
        document.getElementById("confirmModal").close();
        if (confirmCallback) {
            await confirmCallback();
            confirmCallback = null;
        }
    });

    // Initial load
    loadSnapshotList();
}

/**
 * =============================================================================
 * PLUGIN ENTRY POINT
 * =============================================================================
 */

/**
 * Plugin setup function called when panel is shown
 */
entrypoints.setup({
    panels: {
        psdTimeMachinePanel: {
            create() {
                // Build UI when panel is created
                buildUI();
            },
            show() {
                // Refresh snapshot list when panel is shown
                loadSnapshotList();
            }
        }
    }
});
