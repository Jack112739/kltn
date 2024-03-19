/**
 * The editor for writing latex equations
 */

const editor = document.getElementById('editor');
var target = null;

class Editor {
    
    
    static load(node) {
        target = node;
        node.style.display = "none";
        editor.style.display = "";
        editor.querySelector('input.name').value = node.id;
        editor.querySelector('.raw-text').value = node.raw_text;
        swap(node.html_div.querySelector('.tex_render'), editor.querySelector('.latex'));
    }
    static close() {
        //if(!saved && !confirm('you change has not been saved!'));
        editor.querySelector('input.name').value = "";
        editor.querySelector('.raw-text').value = "";
        editor.querySelector('.latex').innerHTML = "";
        editor.style.top = "";
        editor.style.left = "";
        editor.style.display = "none";
        target.style.display = "block";
    }
    static save() {
        // TODO: validate name 
        Editor.recompile();
        target.rename(editor.querySelector('input.name').value);
        target.raw_text = editor.querySelector('.raw-text').value;
        swap(target.html_div.querySelector('.tex_render'), editor.querySelector('.latex'));
    }
    static del() {
        if(!window.confirm(`Are you sure you want to delete this node`)) return;
        target.remove();
        Editor.close();
    }
    static recompile() {
        MathJax.typeset();
    }
}

function swap(u, v) {
    let u_cls = u.className;
    let v_cls = v.className;
    v.className = u_cls;
    u.className = v_cls;
    let place_holder = document.createComment('');
    u.replaceWith(place_holder); 
    v.replaceWith(u);
    place_holder.replaceWith(v);
}