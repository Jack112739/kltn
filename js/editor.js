/**
 * The editor for writing latex
 */

class Editor {
    
    // division contain this editor
    div;
    // name input goes here
    name;
    // The node currently being edited 
    node;
    //raw text input field
    raw;
    // render latex in this div
    latex;

    saved;
    on_visual_mode;
    //current focus fragment if it was visual mode
    focus_start;
    focus_end;

    load(node) {
        if(!node) return;
        GraphUI.current_graph.highlighting = null;
        node.highlight();
        this.node = node;
        this.saved = true;
        this.name.value = node.html_div.querySelector('.header').firstChild.data;
        this.raw.value = node.raw_text;
        this.latex.innerHTML = node.html_div.querySelector('.tex_render').innerHTML;
        this.div.style.display = "";
    }
    
    close() {
        if(!this.saved && !window.confirm('Close without saving changes ?')) return;
        this.raw.value = "";
        this.name.value = "";
        this.latex.innerHTML = "";
        this.div.style.display = "none";
        this.node.fade();
        document.addEventListener('click', GraphUI.monitor_node_at_cursor);
    }
    save() {
        this.saved = true;
        if(!this.on_visual_mode) this.render();
        this.node.raw_text = this.raw.value;
        this.node.rename(this.name.value);
        this.node.html_div.querySelector('.tex_render').innerHTML = this.latex.innerHTML;
    }
    render(then) {
        let frag = new Fragment(this.raw.value, false);
        this.latex.innerHTML = frag.output('text');
        MathJax.Hub?.Queue(['Typeset', MathJax.Hub, this.latex, then]);
    }
    del() {
        if(!window.confirm('Do you want to delete this node ?')) return;
        this.saved = true;
        this.close();
        this.node.remove();
    }
    visual_mode(visual) {
        if(visual) {
            this.raw.style.display = "none";
            this.on_visual_mode = true;
            this.latex.contentEditable = true;
            this.render(() => {
                for(const jax of this.latex.querySelectorAll('script')) VisualEditor.init(jax);
            })
            this.latex.addEventListener('mousedown', VisualEditor.rerender_when_focusout);
            this.latex.addEventListener('keydown', VisualEditor.keydown_handler);
            this.latex.addEventListener('mouseup', VisualEditor.selection_handler);
        }
        else {
            this.focus?.onblur();
            this.raw.style.display = "";
            this.latex.contentEditable = false;
            this.on_visual_mode = false;
            this.latex.onkeydown = null;
            this.latex.onclick = null;
            this.latex.onmouseup = null;
        }
    }
    option(o) {
        
    }
}
function drag_editor(e) {
    if(!e.target.parentNode.classList.contains('settings')) return;
    document.body.style.cursor = "grab";
    let relative_x = editor.div.offsetLeft - e.clientX;
    let relative_y = editor.div.offsetTop - e.clientY;

    document.onmousemove = (e) => {
        editor.div.style.left = e.clientX + relative_x + "px";
        editor.div.style.top = e.clientY + relative_y + "px";
    }
    document.onmouseup = (e) => {
        document.body.style.cursor = "";
        document.onmousemove = null;
        document.onmouseup = null;
    }
}
var editor;

document.addEventListener('DOMContentLoaded', () => {
    editor = new Editor();
    editor.div = document.getElementById('editor');
    editor.name = editor.div.querySelector('input.name');
    editor.raw = editor.div.querySelector('.raw-text');
    editor.latex = editor.div.querySelector('.latex');
    
    editor.div.querySelector('.close').onclick = () => editor.close();
    editor.div.querySelector('.save').onclick = () => editor.save();
    editor.div.querySelector('.del').onclick = () => editor.del();
    editor.div.querySelector('.bold').onclick = () => editor.option('b');
    editor.div.querySelector('.italic').onclick = () => editor.option('i');
    editor.div.querySelector('.ol').onclick = () => editor.option('ol');
    editor.div.querySelector('.ul').onclick = () => editor.option('ul');
    editor.div.querySelector('.rm').onclick = () => editor.option('rm');
    editor.div.querySelector('.align').onclick = () => editor.option('a');  
    editor.div.querySelector('.mode').onchange = (e) => editor.visual_mode(e.target.checked);

    editor.div.querySelector('.settings').onmousedown = drag_editor;
    editor.raw.addEventListener('keydown', SuggestMenu.auto_complete);
    editor.visual_mode(true);
});

