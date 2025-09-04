#!/usr/bin/env python3
"""
Script to automatically update AI models in the frontend
"""
import json
import re
import os

def update_frontend_models(models_file="models.json", frontend_file="index.html"):
    """Update the frontend HTML file with current AI models"""
    
    # Read models from JSON file
    with open(models_file, 'r') as f:
        models_data = json.load(f)
    
    models = models_data.get("models", [])
    default_model = models_data.get("default_model", "llama-3.1-8b-instant")
    
    # Read the frontend file
    with open(frontend_file, 'r') as f:
        content = f.read()
    
    # Update the select options
    select_pattern = r'(<select id="ai-model"[^>]*>)(.*?)(</select>)'
    
    # Create new select options
    options_html = ""
    for model in models:
        selected = " selected" if model["value"] == default_model else ""
        options_html += f'                                    <option value="{model["value"]}"{selected}>{model["display"]}</option>\n'
    
    # Replace the select content
    def replace_select(match):
        return match.group(1) + '\n' + options_html + '                                ' + match.group(3)
    
    content = re.sub(select_pattern, replace_select, content, flags=re.DOTALL)
    
    # Update the JavaScript model mapping
    js_pattern = r'(const modelNames = \{)(.*?)(\};)'
    
    # Create new model mapping
    model_mapping = ""
    for model in models:
        model_mapping += f"                        '{model['value']}': '{model['display']}',\n"
    
    # Remove trailing comma and add closing brace
    model_mapping = model_mapping.rstrip(',\n') + '\n'
    
    def replace_js_mapping(match):
        return match.group(1) + '\n' + model_mapping + '                    ' + match.group(3)
    
    content = re.sub(js_pattern, replace_js_mapping, content, flags=re.DOTALL)
    
    # Write the updated content back to the file
    with open(frontend_file, 'w') as f:
        f.write(content)
    
    print(f"Successfully updated {frontend_file} with current AI models")

if __name__ == "__main__":
    update_frontend_models()
