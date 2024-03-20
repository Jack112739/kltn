/**
 * The editor for writing latex equations
 */

const editor = document.getElementById('editor');
var target = null;

class Editor {
    
    
    static load(node) {
        if(!node) return;
        target = node;
        node.html_div.style.display = "none";
        editor.style.display = "";
        editor.querySelector('input.name').value = node.id;
        editor.querySelector('.raw-text').value = node.raw_text;
        let math_content = node.html_div.querySelector('.tex_render').cloneNode(true);
        let replaced = editor.querySelector('.latex');
        math_content.className = replaced.className;
        replaced.replaceWith(math_content);
    }
    static close() {
        //if(!saved && !confirm('you change has not been saved!'));
        editor.querySelector('input.name').value = "";
        editor.querySelector('.raw-text').value = "";
        editor.style.top = "";
        editor.style.left = "";
        editor.style.display = "none";
        target.html_div.style.display = "block";
    }
    static save() {
        // TODO: validate name 
        Editor.recompile();
        target.rename(editor.querySelector('input.name').value);
        target.raw_text = editor.querySelector('.raw-text').value;
        let new_node = editor.querySelector('.latex').cloneNode(true);
        let dir = target.html_div.querySelector('.tex_render');
        new_node.className = dir.className;
        dir.replaceWith(new_node);
    }
    static del() {
        if(!window.confirm(`Are you sure you want to delete this node`)) return;
        target.remove();
        Editor.close();
    }
    static recompile() {
        katex.render(editor.querySelector('.raw-text').value, editor.querySelector('.latex'), {displayMode: true});
    }
}