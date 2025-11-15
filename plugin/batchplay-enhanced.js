"use strict";

/**
 * Enhanced Layer Manipulation using BatchPlay API
 *
 * This module provides advanced layer manipulation capabilities
 * that go beyond the standard UXP Layer API limitations.
 */

const { batchPlay } = require("photoshop").action;
const { executeAsModal } = require("photoshop").core;

/**
 * =============================================================================
 * LAYER POSITION & TRANSFORM
 * =============================================================================
 */

/**
 * Restores layer position with pixel-perfect accuracy
 * @param {number} layerId - Layer ID
 * @param {Array} bounds - [left, top, right, bottom]
 */
async function restoreLayerBounds(layerId, bounds) {
    try {
        const [left, top, right, bottom] = bounds;
        const width = right - left;
        const height = bottom - top;

        await executeAsModal(async () => {
            // Get current bounds
            const currentBounds = await getLayerBounds(layerId);

            if (!currentBounds) return;

            const [curLeft, curTop] = currentBounds;

            // Calculate offset
            const offsetX = left - curLeft;
            const offsetY = top - curTop;

            // Move layer
            if (offsetX !== 0 || offsetY !== 0) {
                await batchPlay([
                    {
                        _obj: "transform",
                        _target: [{ _ref: "layer", _id: layerId }],
                        freeTransformCenterState: {
                            _enum: "quadCenterState",
                            _value: "QCSAverage"
                        },
                        offset: {
                            _obj: "offset",
                            horizontal: { _unit: "pixelsUnit", _value: offsetX },
                            vertical: { _unit: "pixelsUnit", _value: offsetY }
                        }
                    }
                ], { synchronousExecution: true });
            }
        }, { commandName: "Restore Layer Position" });

        return true;
    } catch (error) {
        console.error("Error restoring layer bounds:", error);
        return false;
    }
}

/**
 * Gets current layer bounds using batchPlay
 * @param {number} layerId - Layer ID
 * @returns {Array|null} [left, top, right, bottom]
 */
async function getLayerBounds(layerId) {
    try {
        const result = await batchPlay([
            {
                _obj: "get",
                _target: [
                    { _property: "bounds" },
                    { _ref: "layer", _id: layerId }
                ]
            }
        ], { synchronousExecution: true });

        if (result && result[0] && result[0].bounds) {
            const b = result[0].bounds;
            return [
                Math.round(b.left._value),
                Math.round(b.top._value),
                Math.round(b.right._value),
                Math.round(b.bottom._value)
            ];
        }

        return null;
    } catch (error) {
        console.error("Error getting layer bounds:", error);
        return null;
    }
}

/**
 * =============================================================================
 * LAYER EFFECTS
 * =============================================================================
 */

/**
 * Captures complete layer style/effects data
 * @param {number} layerId - Layer ID
 * @returns {Object|null} Layer style descriptor
 */
async function captureLayerEffects(layerId) {
    try {
        const result = await batchPlay([
            {
                _obj: "get",
                _target: [
                    { _property: "layerEffects" },
                    { _ref: "layer", _id: layerId }
                ]
            }
        ], { synchronousExecution: true });

        return result && result[0] ? result[0].layerEffects : null;
    } catch (error) {
        // Layer has no effects
        return null;
    }
}

/**
 * Restores layer effects/styles
 * @param {number} layerId - Layer ID
 * @param {Object} effects - Layer effects descriptor
 */
async function restoreLayerEffects(layerId, effects) {
    if (!effects) return true;

    try {
        await executeAsModal(async () => {
            await batchPlay([
                {
                    _obj: "set",
                    _target: [{ _ref: "layer", _id: layerId }],
                    to: {
                        _obj: "layer",
                        layerEffects: effects
                    }
                }
            ], { synchronousExecution: true });
        }, { commandName: "Restore Layer Effects" });

        return true;
    } catch (error) {
        console.error("Error restoring layer effects:", error);
        return false;
    }
}

/**
 * =============================================================================
 * TEXT LAYER ENHANCEMENTS
 * =============================================================================
 */

/**
 * Captures complete text layer formatting
 * @param {number} layerId - Layer ID
 * @returns {Object|null} Text style data
 */
async function captureTextFormatting(layerId) {
    try {
        const result = await batchPlay([
            {
                _obj: "get",
                _target: [
                    { _property: "textKey" },
                    { _ref: "layer", _id: layerId }
                ]
            }
        ], { synchronousExecution: true });

        return result && result[0] ? result[0].textKey : null;
    } catch (error) {
        return null;
    }
}

/**
 * Restores complete text formatting
 * @param {number} layerId - Layer ID
 * @param {Object} textKey - Text formatting descriptor
 */
async function restoreTextFormatting(layerId, textKey) {
    if (!textKey) return true;

    try {
        await executeAsModal(async () => {
            await batchPlay([
                {
                    _obj: "set",
                    _target: [{ _ref: "layer", _id: layerId }],
                    to: {
                        _obj: "textLayer",
                        textKey: textKey
                    }
                }
            ], { synchronousExecution: true });
        }, { commandName: "Restore Text Formatting" });

        return true;
    } catch (error) {
        console.error("Error restoring text formatting:", error);
        return false;
    }
}

/**
 * =============================================================================
 * SMART OBJECT ENHANCEMENTS
 * =============================================================================
 */

/**
 * Captures smart object transform data
 * @param {number} layerId - Layer ID
 * @returns {Object|null} Transform data
 */
async function captureSmartObjectTransform(layerId) {
    try {
        const result = await batchPlay([
            {
                _obj: "get",
                _target: [
                    { _property: "smartObject" },
                    { _ref: "layer", _id: layerId }
                ]
            }
        ], { synchronousExecution: true });

        return result && result[0] ? result[0].smartObject : null;
    } catch (error) {
        return null;
    }
}

/**
 * =============================================================================
 * ENHANCED METADATA COLLECTION
 * =============================================================================
 */

/**
 * Collects complete layer metadata using BatchPlay
 * @param {number} layerId - Layer ID
 * @returns {Object} Complete layer metadata
 */
async function collectEnhancedLayerMetadata(layerId) {
    try {
        const result = await batchPlay([
            {
                _obj: "multiGet",
                _target: [{ _ref: "layer", _id: layerId }],
                extendedReference: [
                    { _property: "name" },
                    { _property: "layerID" },
                    { _property: "itemIndex" },
                    { _property: "visible" },
                    { _property: "opacity" },
                    { _property: "mode" },
                    { _property: "bounds" },
                    { _property: "boundsNoEffects" },
                    { _property: "layerKind" },
                    { _property: "textKey" },
                    { _property: "smartObject" },
                    { _property: "layerEffects" },
                    { _property: "fillOpacity" },
                    { _property: "layerLocking" },
                    { _property: "blendOptions" }
                ]
            }
        ], { synchronousExecution: true });

        if (!result || !result[0]) return null;

        const data = result[0];

        return {
            layerId: data.layerID || layerId,
            name: data.name || "Unnamed",
            visible: data.visible !== undefined ? data.visible : true,
            opacity: data.opacity ? data.opacity._value : 100,
            blendMode: data.mode ? data.mode._value : "normal",
            bounds: data.bounds ? [
                Math.round(data.bounds.left._value),
                Math.round(data.bounds.top._value),
                Math.round(data.bounds.right._value),
                Math.round(data.bounds.bottom._value)
            ] : null,
            boundsNoEffects: data.boundsNoEffects ? [
                Math.round(data.boundsNoEffects.left._value),
                Math.round(data.boundsNoEffects.top._value),
                Math.round(data.boundsNoEffects.right._value),
                Math.round(data.boundsNoEffects.bottom._value)
            ] : null,
            kind: data.layerKind ? data.layerKind._value : "pixel",
            textKey: data.textKey || null,
            smartObject: data.smartObject || null,
            layerEffects: data.layerEffects || null,
            fillOpacity: data.fillOpacity ? data.fillOpacity._value : 100,
            blendOptions: data.blendOptions || null
        };
    } catch (error) {
        console.error("Error collecting enhanced layer metadata:", error);
        return null;
    }
}

/**
 * =============================================================================
 * BATCH RESTORE OPERATIONS
 * =============================================================================
 */

/**
 * Restores multiple layer properties in a single batch operation
 * @param {number} layerId - Layer ID
 * @param {Object} metadata - Layer metadata to restore
 */
async function batchRestoreLayerProperties(layerId, metadata) {
    const commands = [];

    try {
        await executeAsModal(async () => {
            // Build batch command array
            const layerProps = {};

            if (metadata.opacity !== undefined) {
                layerProps.opacity = { _unit: "percentUnit", _value: metadata.opacity };
            }

            if (metadata.blendMode) {
                layerProps.mode = { _enum: "blendMode", _value: metadata.blendMode };
            }

            if (metadata.visible !== undefined) {
                layerProps.visible = metadata.visible;
            }

            if (metadata.fillOpacity !== undefined) {
                layerProps.fillOpacity = { _unit: "percentUnit", _value: metadata.fillOpacity };
            }

            // Set basic properties
            if (Object.keys(layerProps).length > 0) {
                commands.push({
                    _obj: "set",
                    _target: [{ _ref: "layer", _id: layerId }],
                    to: {
                        _obj: "layer",
                        ...layerProps
                    }
                });
            }

            // Restore layer effects
            if (metadata.layerEffects) {
                commands.push({
                    _obj: "set",
                    _target: [{ _ref: "layer", _id: layerId }],
                    to: {
                        _obj: "layer",
                        layerEffects: metadata.layerEffects
                    }
                });
            }

            // Restore text formatting
            if (metadata.textKey) {
                commands.push({
                    _obj: "set",
                    _target: [{ _ref: "layer", _id: layerId }],
                    to: {
                        _obj: "textLayer",
                        textKey: metadata.textKey
                    }
                });
            }

            // Execute all commands in batch
            if (commands.length > 0) {
                await batchPlay(commands, { synchronousExecution: true });
            }

            // Restore position (needs separate command)
            if (metadata.bounds) {
                await restoreLayerBounds(layerId, metadata.bounds);
            }
        }, { commandName: "Batch Restore Layer" });

        return true;
    } catch (error) {
        console.error("Error in batch restore:", error);
        return false;
    }
}

/**
 * =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
    // Position & Transform
    restoreLayerBounds,
    getLayerBounds,

    // Layer Effects
    captureLayerEffects,
    restoreLayerEffects,

    // Text Formatting
    captureTextFormatting,
    restoreTextFormatting,

    // Smart Objects
    captureSmartObjectTransform,

    // Enhanced Metadata
    collectEnhancedLayerMetadata,

    // Batch Operations
    batchRestoreLayerProperties
};
