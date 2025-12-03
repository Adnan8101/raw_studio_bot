#!/bin/bash

# Create a temporary Node.js script to remove comments
cat << 'EOF' > remove_comments.js
const fs = require('fs');
const path = require('path');

function removeComments(content) {
    // Regex to match strings, regex literals, and comments
    // Group 1: Strings and Regex literals (preserved)
    // Group 6: Single line comments (removed)
    // Group 7: Multi line comments (removed)
    const regex = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`|\/(\\[/]|[^\n/])+\/[gimuy]*)|(\/\/.*)|(\/\*[\s\S]*?\*\/)/g;
    
    return content.replace(regex, (match, str, s1, s2, s3, s4, singleLine, multiLine) => {
        if (str) return str; // It's a string or regex, keep it
        return ''; // It's a comment, remove it
    });
}

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
                processDir(fullPath);
            }
        } else if (file.endsWith('.ts')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const newContent = removeComments(content);
                // Clean up empty lines resulting from comment removal (optional, but looks better)
                // const cleanedContent = newContent.replace(/^\s*[\r\n]/gm, ''); 
                // Keeping it simple to avoid breaking formatting too much
                
                if (content !== newContent) {
                    fs.writeFileSync(fullPath, newContent);
                    console.log(`Processed ${fullPath}`);
                }
            } catch (err) {
                console.error(`Error processing ${fullPath}:`, err);
            }
        }
    }
}

// Start from the current directory
processDir(process.cwd());
EOF

# Run the Node.js script
node remove_comments.js

# Remove the temporary script
rm remove_comments.js

echo "Comments removed from all .ts files."
