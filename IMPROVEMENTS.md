# PSD Time Machine - Improvement Roadmap

## High Priority Improvements

### 1. **Use BatchPlay API for Precise Layer Manipulation**

**Current Limitation:** The UXP Layer API doesn't support direct positioning or complete layer property restoration.

**Improvement:**
```javascript
const { executeAsModal } = require("photoshop").core;
const { batchPlay } = require("photoshop").action;

// Example: Restore layer position accurately
async function restoreLayerPosition(layerId, bounds) {
    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "move",
                _target: [{ _ref: "layer", _id: layerId }],
                _obj: "offset",
                horizontal: { _unit: "pixelsUnit", _value: bounds[0] },
                vertical: { _unit: "pixelsUnit", _value: bounds[1] }
            }
        ], {});
    }, { commandName: "Restore Position" });
}

// Restore layer effects (drop shadow, stroke, etc.)
async function restoreLayerEffects(layerId, effects) {
    // BatchPlay commands for each effect type
}
```

**Benefits:**
- Pixel-perfect position restoration
- Complete layer effects support
- Transform data for smart objects
- Mask and adjustment layer support

---

### 2. **Delta/Incremental Snapshots**

**Current Issue:** Each snapshot stores complete layer data, causing file bloat.

**Improvement:**
```javascript
{
  "documentName": "example.psd",
  "version": "2.0",
  "baseSnapshot": {
    "id": "base-001",
    "layers": [/* full data */]
  },
  "snapshots": [
    {
      "id": "snap-002",
      "parentId": "base-001",
      "label": "Quick fix",
      "changes": {
        "modified": [
          {
            "layerId": 1234,
            "properties": {
              "opacity": 85,  // Only changed properties
              "visible": false
            }
          }
        ],
        "added": [],
        "removed": []
      }
    }
  ]
}
```

**Benefits:**
- 70-90% smaller file sizes
- Faster save operations
- Better for version control (Git)
- Clear change history

---

### 3. **Visual Timeline View**

**Improvement:** Replace list view with an interactive timeline.

```html
<!-- Timeline UI -->
<div class="timeline">
    <div class="timeline-track">
        <div class="snapshot-marker" data-id="snap-001" style="left: 0%">
            <div class="marker-dot"></div>
            <div class="marker-label">Initial</div>
        </div>
        <div class="snapshot-marker" data-id="snap-002" style="left: 33%">
            <div class="marker-dot"></div>
            <div class="marker-label">After feedback</div>
        </div>
        <div class="snapshot-marker current" data-id="snap-003" style="left: 100%">
            <div class="marker-dot"></div>
            <div class="marker-label">Current</div>
        </div>
    </div>
</div>
```

**Features:**
- Drag to scrub through time
- Visual branching for alternative versions
- Zoom in/out on timeline
- Quick preview on hover

---

### 4. **Layer Thumbnail Previews**

**Improvement:** Capture small thumbnails of changed layers.

```javascript
async function captureLayerThumbnail(layer, maxSize = 64) {
    // Use batchPlay to export layer as base64 thumbnail
    const result = await batchPlay([
        {
            _obj: "exportSelectionAsFileTypePressed",
            _target: [{ _ref: "layer", _id: layer.id }],
            fileType: "PNG",
            quality: 5,
            width: maxSize,
            height: maxSize
        }
    ], { synchronousExecution: true });

    return result[0].base64Data;
}

// Store in snapshot
{
    "layerId": 1234,
    "name": "Dragon",
    "thumbnail": "data:image/png;base64,iVBOR..."
}
```

**Benefits:**
- Visual identification of layers
- Easier diff visualization
- Better snapshot selection

---

### 5. **Smart Layer Matching Algorithm**

**Current Issue:** Layer matching by ID fails if layers are duplicated/merged.

**Improvement:**
```javascript
function calculateLayerSimilarity(snapshot, current) {
    let score = 0;

    // ID match (highest priority)
    if (snapshot.layerId === current.layerId) score += 50;

    // Name similarity (fuzzy match)
    const nameSim = stringSimilarity(snapshot.name, current.name);
    score += nameSim * 20;

    // Path similarity
    const pathSim = stringSimilarity(snapshot.path, current.path);
    score += pathSim * 15;

    // Position proximity (if within 50px)
    if (snapshot.bounds && current.bounds) {
        const dist = Math.sqrt(
            Math.pow(snapshot.bounds[0] - current.bounds[0], 2) +
            Math.pow(snapshot.bounds[1] - current.bounds[1], 2)
        );
        if (dist < 50) score += 10;
    }

    // Type match
    if (snapshot.kind === current.kind) score += 5;

    return score;
}

// Use fuzzy matching for renamed/restructured layers
function findBestLayerMatch(snapshotLayer, currentLayers) {
    let bestMatch = null;
    let bestScore = 0;

    for (const layer of currentLayers) {
        const score = calculateLayerSimilarity(snapshotLayer, layer);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = layer;
        }
    }

    return bestScore > 30 ? bestMatch : null;
}
```

---

### 6. **Auto-Snapshot on Save**

**Improvement:** Optional automatic snapshots.

```javascript
// Add to settings
const settings = {
    autoSnapshot: true,
    autoSnapshotInterval: 'onSave', // or 'every5min', 'every10min'
    autoSnapshotPrefix: 'Auto',
    maxAutoSnapshots: 10  // Keep only last 10 auto-snapshots
};

// Listen for document save events
app.eventNotifier = (event, descriptor) => {
    if (event === 'save' && settings.autoSnapshot) {
        createSnapshot(
            `${settings.autoSnapshotPrefix} - ${new Date().toLocaleTimeString()}`,
            'Automatic snapshot',
            true  // isAuto flag
        );

        // Clean up old auto-snapshots
        cleanupAutoSnapshots(settings.maxAutoSnapshots);
    }
};
```

---

### 7. **Quick Snapshot (One-Click)**

**Improvement:** Fast snapshot without dialog.

```html
<sp-button id="quickSnapshotBtn" variant="secondary" quiet>
    ⚡ Quick Snapshot
</sp-button>
```

```javascript
async function quickSnapshot() {
    const label = `Quick ${new Date().toLocaleTimeString()}`;
    await createSnapshot(label, '', true);
}
```

---

### 8. **Snapshot Tags and Categories**

**Improvement:** Organize snapshots better.

```json
{
    "id": "snap-001",
    "label": "Hero section complete",
    "tags": ["milestone", "client-approved", "v2"],
    "category": "design-iteration",
    "color": "#4CAF50"
}
```

**UI:**
- Filter by tag
- Color-coded categories
- Search by tag/label/note

---

### 9. **Comparison View (Side-by-Side)**

**Improvement:** Visual diff with split view.

```html
<div class="comparison-view">
    <div class="comparison-panel">
        <h4>Snapshot: "After feedback"</h4>
        <div class="layer-list">
            <!-- Snapshot layers with thumbnails -->
        </div>
    </div>
    <div class="comparison-divider"></div>
    <div class="comparison-panel">
        <h4>Current State</h4>
        <div class="layer-list">
            <!-- Current layers with thumbnails -->
        </div>
    </div>
</div>
```

**Features:**
- Highlight changed layers
- Show visual differences
- Click to focus layer in Photoshop

---

### 10. **Export/Import Snapshots**

**Improvement:** Share snapshots between documents or team members.

```javascript
async function exportSnapshot(snapshotId) {
    const snapshot = findSnapshot(snapshotId);
    const exportData = {
        format: 'psdtime-snapshot',
        version: '1.0',
        snapshot: snapshot,
        metadata: {
            exportedBy: 'username',
            exportedAt: new Date().toISOString(),
            originalDocument: app.activeDocument.name
        }
    };

    // Let user choose export location
    const file = await fs.getFileForSaving('snapshot.json');
    await file.write(JSON.stringify(exportData, null, 2));
}

async function importSnapshot() {
    const file = await fs.getFileForOpening({ types: ['json'] });
    const data = JSON.parse(await file.read());

    // Validate and merge into current document
    if (data.format === 'psdtime-snapshot') {
        mergeSnapshot(data.snapshot);
    }
}
```

---

## Medium Priority Improvements

### 11. **Snapshot Branching**

Create alternative versions from any snapshot:

```
main: [S1] -> [S2] -> [S3] -> [S4]
                \
                 -> [S5-alt] -> [S6-alt]
```

### 12. **Keyboard Shortcuts**

```javascript
// Register shortcuts
{
    "Ctrl+Shift+S": quickSnapshot,
    "Ctrl+Shift+R": restoreLastSnapshot,
    "Ctrl+Shift+D": diffWithLastSnapshot
}
```

### 13. **Search and Filter**

- Full-text search across labels and notes
- Filter by date range
- Filter by layers changed
- Filter by tags

### 14. **Snapshot Notes with Markdown**

Support rich formatting in notes:

```markdown
## Changes
- Made logo **bigger**
- Adjusted CTA color to `#FF5733`
- Fixed alignment issues

![Screenshot](data:image/png;base64,...)
```

### 15. **Performance Optimization**

- Lazy load snapshots (load only visible ones)
- Use Web Workers for diff calculations
- Cache layer data during session
- Debounce UI updates

### 16. **Conflict Resolution**

When restoring snapshots with conflicts:

```javascript
// Show conflict resolution UI
{
    layer: "Hero/Title",
    conflict: "Layer has been modified",
    options: [
        "Keep current version",
        "Use snapshot version",
        "Merge (keep both as variants)"
    ]
}
```

### 17. **Undo/Redo for Snapshot Operations**

- Maintain operation history
- Undo snapshot creation
- Undo snapshot restoration

### 18. **Snapshot Diff Statistics**

```javascript
{
    totalChanges: 23,
    breakdown: {
        textChanges: 5,
        positionChanges: 12,
        styleChanges: 6,
        layersAdded: 2,
        layersRemoved: 1
    },
    impactScore: "medium"  // low, medium, high
}
```

---

## Advanced Features

### 19. **Cloud Sync (Optional)**

- Sync snapshots to cloud storage
- Team collaboration features
- Real-time snapshot sharing

### 20. **AI-Powered Features**

- Auto-generate snapshot labels based on changes
- Suggest optimal times to snapshot
- Detect significant design changes automatically

### 21. **Integration with Version Control**

```javascript
// Git integration
async function commitSnapshotToGit(snapshot) {
    // Create git commit with snapshot data
    await exec(`git add *.psdtime.json`);
    await exec(`git commit -m "Snapshot: ${snapshot.label}"`);
}
```

### 22. **Plugin API for Extensibility**

```javascript
// Allow other plugins to integrate
PSDTimeMachine.registerHook('beforeSnapshot', async (data) => {
    // Other plugins can modify or extend snapshot data
    return data;
});
```

### 23. **Snapshot Presets/Templates**

- Save common snapshot configurations
- Quick apply preset metadata
- Team templates

### 24. **Analytics Dashboard**

- Track snapshot frequency
- Most changed layers
- Team activity (if shared)
- Document evolution metrics

---

## Technical Debt & Code Quality

### 25. **Error Handling Enhancement**

- Retry logic for file operations
- Graceful degradation
- Better error messages with suggestions

### 26. **Unit Tests**

```javascript
// Add comprehensive tests
describe('Layer Matching', () => {
    test('should match layer by ID', () => {
        // ...
    });

    test('should fallback to fuzzy matching', () => {
        // ...
    });
});
```

### 27. **Performance Monitoring**

```javascript
// Track operation times
const metrics = {
    snapshotCreationTime: [],
    restoreTime: [],
    diffTime: []
};
```

### 28. **Accessibility**

- Keyboard navigation
- Screen reader support
- High contrast mode
- Larger text options

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| BatchPlay API | High | High | 1 |
| Delta Snapshots | High | Medium | 2 |
| Visual Timeline | High | High | 3 |
| Quick Snapshot | Medium | Low | 4 |
| Layer Thumbnails | High | Medium | 5 |
| Smart Matching | Medium | Medium | 6 |
| Auto-Snapshot | Medium | Low | 7 |
| Tags/Categories | Medium | Low | 8 |
| Export/Import | Medium | Medium | 9 |
| Comparison View | High | High | 10 |

---

## Estimated Impact

### File Size Reduction
- Current: ~500KB for 100 layers
- With Delta: ~50KB per snapshot after base
- **Savings: 90%**

### Performance
- Current: 2-3s snapshot creation
- With optimization: <1s
- **Improvement: 60%**

### User Experience
- Timeline + Thumbnails: **Significantly better** visual understanding
- Quick Snapshot: **Faster workflow** by 80%
- Smart Matching: **95% accuracy** vs 70% current

---

## Next Steps

1. **Phase 1** (Week 1-2): Implement BatchPlay API for accurate restoration
2. **Phase 2** (Week 3-4): Add delta snapshots and file optimization
3. **Phase 3** (Week 5-6): Build visual timeline and thumbnail system
4. **Phase 4** (Week 7-8): Smart matching and comparison view
5. **Phase 5** (Week 9+): Advanced features and polish

