# PSD Time Machine

A Photoshop UXP plugin that provides version control for PSD layer metadata. Create snapshots, restore previous states, and track changes over time.

## Features

- **Create Snapshots**: Capture the current state of all layers with metadata including:
  - Layer IDs, names, and full paths
  - Visibility, opacity, and blend modes
  - Text content for text layers
  - Layer bounds (position)
  - Smart object information
  - Layer effects

- **Restore Snapshots**: Revert your document to a previous snapshot state

- **Compare Changes**: View detailed differences between snapshots and current state
  - Text changes
  - Position/bounds changes
  - Visibility changes
  - Opacity changes
  - Blend mode changes
  - Added/removed layers

- **External Storage**: Snapshots are stored in a `.psdtime.json` file next to your PSD, making it easy to:
  - Track changes over time
  - Share snapshots with version control (Git)
  - Backup snapshot history separately

## Installation

### Method 1: Using UXP Developer Tool (Recommended for Development)

1. Download or clone this repository
2. Open **Adobe UXP Developer Tool**
3. Click **Add Plugin**
4. Navigate to the `plugin` folder and select `manifest.json`
5. Click **Load**
6. In Photoshop, go to **Plugins > PSD Time Machine**

### Method 2: Manual Installation

1. Copy the `plugin` folder to your Photoshop plugins directory:
   - **Windows**: `C:\Program Files\Common Files\Adobe\CEP\extensions\`
   - **macOS**: `/Library/Application Support/Adobe/CEP/extensions/`

2. Restart Photoshop
3. Access the plugin via **Plugins > PSD Time Machine**

## Usage

### Creating a Snapshot

1. Open a PSD file in Photoshop (must be saved)
2. Open the PSD Time Machine panel
3. Click **Create Snapshot**
4. Enter a descriptive label (e.g., "After client feedback")
5. Optionally add notes/comments
6. Click **Create**

The snapshot will be saved to `<your-file>.psdtime.json` in the same directory as your PSD.

### Restoring a Snapshot

1. Select a snapshot from the list
2. Click **Restore**
3. Confirm the action
4. The plugin will restore:
   - Layer visibility
   - Layer opacity
   - Blend modes
   - Text content (for text layers)

### Viewing Differences

1. Select a snapshot from the list
2. Click **Diff**
3. Review the changes:
   - Text modifications
   - Position shifts
   - Visibility toggles
   - Opacity adjustments
   - Blend mode changes
   - Added/removed layers

### Deleting a Snapshot

1. Select a snapshot from the list
2. Click **Delete**
3. Confirm the deletion

## File Format

Snapshots are stored in JSON format:

```json
{
  "documentName": "example.psd",
  "version": "1.0",
  "snapshots": [
    {
      "id": "2025-11-15T12-34-01Z",
      "label": "Initial design",
      "note": "First version before feedback",
      "createdAt": "2025-11-15T12:34:01Z",
      "layers": [
        {
          "layerId": 1234,
          "path": "Main/Characters/Dragon",
          "name": "Dragon",
          "visible": true,
          "opacity": 100,
          "blendMode": "normal",
          "bounds": [120, 250, 820, 950],
          "kind": "pixel",
          "text": null,
          "smartObject": {
            "linked": false
          },
          "effects": {}
        }
      ]
    }
  ]
}
```

## Edge Cases Handled

- **No active document**: Shows error message
- **Unsaved document**: Prompts user to save first
- **Missing .psdtime.json file**: Creates new file automatically
- **Snapshot for different document**: Blocks restore with warning
- **Missing layers during restore**: Skips gracefully
- **Renamed/moved layers**: Attempts fallback matching by path and name
- **Deeply nested layer groups**: Fully supported via recursive traversal

## Limitations

- **No raster data**: Snapshots store metadata only, not pixel data
- **Position restoration**: Limited by UXP API capabilities (some transforms may require manual adjustment)
- **Layer effects**: Detection is simplified (full effects would require batchPlay API)
- **Smart object transforms**: Basic info stored, full transform restoration limited

## Technical Details

- **Built with**: UXP (Unified Extensibility Platform)
- **Compatible with**: Photoshop 23.0.0+
- **Storage**: Local file system using `uxp.storage.localFileSystem`
- **No external dependencies**: Pure UXP/JavaScript implementation

## Development

### Project Structure

```
plugin/
├── manifest.json       # Plugin configuration
├── index.html          # UI structure
├── styles.css          # Styling
└── main.js             # Core logic
```

### Key Functions

- `createSnapshot(label, note)` - Creates a new snapshot
- `restoreSnapshot(snapshotId)` - Restores a snapshot
- `diffSnapshot(snapshotId)` - Compares snapshot with current state
- `collectAllLayersMetadata(layers)` - Recursively collects layer metadata
- `readTimeMachineFile(psdPath)` - Reads snapshot file
- `writeTimeMachineFile(psdPath, data)` - Writes snapshot file

## Version Control Integration

The `.psdtime.json` files are designed to work well with Git:

```bash
# Track snapshot history
git add *.psdtime.json
git commit -m "Add design snapshots"

# Share with team
git push
```

Team members can restore snapshots on their machines as long as layer IDs match.

## Troubleshooting

**Plugin doesn't appear in Photoshop**
- Ensure Photoshop version is 23.0.0 or higher
- Check that the plugin is properly loaded in UXP Developer Tool
- Restart Photoshop

**Cannot create snapshot**
- Verify the document is saved
- Check file system permissions for the PSD directory
- Ensure disk space is available

**Restore doesn't work perfectly**
- Some layer properties may require manual adjustment due to UXP API limitations
- Complex layer transforms may not restore exactly
- Check console for specific layer errors

**Snapshot file not found**
- Ensure the PSD file is saved in the same location as before
- Check that the `.psdtime.json` file wasn't moved or deleted

## License

This plugin is provided as-is for use with Adobe Photoshop.

## Support

For issues, questions, or feature requests, please file an issue in the project repository.

---

**Happy Time Traveling!** 🚀
