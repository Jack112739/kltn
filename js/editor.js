/**
 * The editor for writing latex equations
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
    // queue for undo and redo
    snapshot;
    //save ?
    saved;

    load(node) {
        this.node = node;
        this.saved = true;
        this.name.value = node.html_div.querySelector('.header').firstChild.data;
        this.raw.value = node.raw_text;
        //TODO: optimize this
        this.latex.innerHTML = node.html_div.querySelector('.tex_render').innerHTML;
        this.div.style.display = "";
    }

    close() {
        if(!this.saved && !window.confirm('Close without saving changes ?')) return;
        this.raw.value = "";
        this.name.value = "";
        this.latex.innerHTML = "";
        this.div.style.display = "none";
    }
    save() {
        this.saved = true;
        this.render();
        this.node.raw_text = this.raw.value;
        this.node.rename(this.name.value);
        //TODO optimize this
        this.node.html_div.querySelector('.tex_render').innerHTML = this.latex.innerHTML;
    }
    render() {
        let i = 0;
        let raw = this.raw.value;
        this.latex.innerHTML = "";
        while(i < raw.length) {
            if(raw.charAt(i) != '$') {
                let txt = new String();
                while(i < raw.length && raw.charAt(i) != '$') {
                    txt += raw.charAt(i);
                    i++;
                }
                this.latex.appendChild(document.createTextNode(txt));
            }
            else {
                let display = false;
                let repr = 'span';
                let txt = new String();
                i++;
                if(i < raw.length && raw.charAt(i) == '$') {
                    display = true;
                    repr = 'div';
                    i++;
                }
                while(i < raw.length && raw.charAt(i) != '$') {
                    txt += raw.charAt(i);
                    i++;
                }
                i++;
                if(display) {
                    if(i > raw.length || raw.charAt(i) != '$') txt = `\\textcolor{red}{${txt}}`;
                    i++;
                }
                let render_elem = document.createElement(repr);
                katex.render(txt, render_elem, {throwOnError: false, displayMode: display});
                this.latex.appendChild(render_elem);
            }
        }
    }
    del() {
        if(!window.confirm('Do you want to delete this node ?')) return;
        this.saved = true;
        this.close();
        this.node.remove();
        this.snapshot.splice(0, this.snapshot.length);
    }
    // options for manipulating the text
    option(o) {
        switch(o) {
            case 'b':
                console.log('bold');
            case 'i':
                console.log('italic')
            case 'u':
                console.log('underline')
            case 'a':
                console.log('align');
            case 'l':
                console.log('list');
            default:
                if(o.charAt(0) != '#') throw Error('not supported for this mode');
                console.log('color', o);
        }
    }
    // change the editor mode
    mode(m) {
        console.log('not implemented', m);
    }

}



var editor;

document.addEventListener('DOMContentLoaded', () => {
    editor = new Editor();
    editor.snapshot = new Array();
    editor.div = document.getElementById('editor');
    editor.name = editor.div.querySelector('input.name');
    editor.raw = editor.div.querySelector('.raw-text');
    editor.latex = editor.div.querySelector('.latex');
    
    editor.div.querySelector('.close').onclick = () => editor.close();
    editor.div.querySelector('.save').onclick = () => editor.save();
    editor.div.querySelector('.del').onclick = () => editor.del();
    editor.div.querySelector('.bold').onclick = () => editor.option('b');
    editor.div.querySelector('.italic').onclick = () => editor.option('i');
    editor.div.querySelector('.underline').onclick = () => editor.option('u');
    editor.div.querySelector('.align').onclick = () => editor.option('a');
    editor.div.querySelector('.olist').onclick = () => editor.option('l');
    editor.div.querySelector('.text-color').onchange = (e) => editor.option(e.target.value);
    editor.div.querySelector('.mode').onchange = (e) => editor.mode(e.target.value);

    editor.div.querySelector('.settings').onmousedown = (e) => {
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
});