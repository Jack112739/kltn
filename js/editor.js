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
    focus_element


    load(node) {
        if(!node) return;
        GraphUI.current_graph.highlighting = null;
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
        this.node.fade();
        document.addEventListener('click', GraphUI.monitor_node_at_cursor);
    }
    save() {
        this.saved = true;
        this.render();
        this.node.raw_text = this.raw.value;
        this.node.rename(this.name.value);
        //TODO optimize this
        this.node.html_div.querySelector('.tex_render').innerHTML = this.latex.innerHTML;
    }
    render(then) {
        this.latex = this.convert_html(this.raw.data);
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.latex, then]);
    }
    del() {
        if(!window.confirm('Do you want to delete this node ?')) return;
        this.saved = true;
        this.close();
        this.node.remove();
    }
    visual_mode(visual) {
        this.edit_on = null;
        if(visual) {    
            this.raw.style.display = "none";
            this.latex.contentEditable = true;
        }
        else {
            this.raw.style.display = "flex";
            this.latex.contentEditable = false;
            this.raw.addEventListener('keydown', auto_complete);
        }
    }
    insert_and_set(str, start_offset, end_offset) {
        document.execCommand('insertText', false, str);
        if(!this.on_visual_mode) {
            this.raw.selectionStart = start_offset;
            this.raw.selectionEnd = end_offset;
        }
        else {
            let range = document.createRange();
            let sel = window.getSelection();
            if(sel.anchorNode !== sel.focusNode) throw new Error('this should not happen');
            range.setStart(sel.anchorNode, start_offset);
            range.setEnd(sel.anchorNode, end_offset);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }
    }
    get_selection() {
        if(!this.on_visual_mode) {
            return {str: this.raw.value, start: this.raw.selectionStart, end: this.raw.selectionEnd};
        }
        else {
            let sel = window.getSelection();
            if(sel.anchorNode !== sel.focusNode) throw new Error('this should not happen');
            return {str: sel.anchorNode, start: sel.anchorOffset, end: sel.focusOffset};
        }
    }
    option(o) {
        let {str, start, end} = editor.get_selection();
        if(str === null) return;
        let selected = str.slice(start, end);
        let replace = '', start_offset = 0, end_offset = 0;
        switch(o) {
        case 'b':
        case 'i':
        case 'ol':
        case 'ul':
            replace = `<${o}>`;
            if(o.length !== 2) replace += selected;
            else {
                replace += '\n  <li> ';
                
                for(const chars of selected) {
                    if(chars === '\n') replace += ' </li>\n  <li> ';
                    else replace += chars;
                }
                replace += ' </li>\n';
            }
            replace += `</${o}>`;
            start_offset = `<${o}>`.length + (o.length == 2 ? 1: 0);
            end_offset = `</${o}>`.length;
            break;
        case 'rm':
            for(let j = 0; j < selected.length;) {
                let tag = null;
                if(tag = allow_tag.map(t => `<${t}>`).find(t => selected.startsWith(t, j))
                        ?? allow_tag.map(t => `</${t}>`).find(t => selected.startsWith(t, j)))
                {
                    j += tag.length;
                    replace += ' ';
                } 
                else replace += selected[j], j += 1;
            }
            break;
        case 'a':
            let search_for = relations.find(arr => arr.some(str => selected.includes(str)));
            if(!search_for) { alert('no relation found'); return; }
            // = can also be used in those type of comparison
            if(search_for[0] !== '\\implies') search_for.push('=');

            replace = '\n\\begin{align*}\n  &';
            for(let i = 0; i < selected.length; i++) {
                if(search_for.some(str => selected.startsWith(str, i))) {
                    replace += '\\\\\n  &';
                }
                replace += selected[i];
            }
            replace += '\\\\\n\\end{align*}\n';
            start_offset = '\n\\begin{align*}\n'.length;
            end_offset = '\n\\end{align*}\n'.length;
            break;
        default:
            throw new Error('text edit option is not supported')
        }
        editor.insert_and_set(replace, start + start_offset, start + replace.length - end_offset);
    }
}
function auto_complete(e) {
    let {str, start, end} = editor.get_selection();
    if(!str) return;

    const lookup = Object.assign({}, {'(':')','[':']','{':'}','$':'$'}, tags, math_delimeter) 
    let replace = '';
    switch(e.key) {
    case '>':
    case '$':
    case '(':
    case '[':
    case '{':
        let candidate = str.slice(Math.max(0, start - 10), start) + e.key, open = null;
        if(open = Object.keys(lookup).find(t => candidate.endsWith(t))) {
            e.preventDefault();
            replace = e.key + (open.length == 1 ? str.slice(start, end): '') + lookup[open];
            start += 1;
            // if it was a close bracket then still select it, otherwise just append text
            if(cl[i].length == 1) end = start  + replace.length - 2;
            else end = start;
            return editor.insert_and_set(replace, start, end);
        }
        break;
    case '\\':
        (editor.on_visual_mode ? editor.latex : editor.raw)
        .addEventListener('keydown', (e) => console.log('not implemented')); 
        break;
    default:
        break;
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
    editor.div.querySelector('.align').onclick = () => editor.option('a');  
    editor.div.querySelector('.ol').onclick = () => editor.option('ol');
    editor.div.querySelector('.ul').onclick = () => editor.option('ul');
    editor.div.querySelector('.rm').onclick = () => editor.option('rm');
    editor.div.querySelector('.mode').onchange = (e) => editor.visual_mode(e.target.checked);

    editor.div.querySelector('.settings').onmousedown = drag_editor;
    editor.visual_mode(true);
});



//tags that can be use to format the text
const allow_tag = ['b', 'i', 'ol', 'ul', 'li'];
const tags = allow_tag.reduce((name, acc) =>acc[`<${name}>`] = `</${name}>` ,{});
const math_delimeter = {'$$':'$$', '$':'$', '\\[':'\\]', '\\(':'\\)'};
const relations = [
    ['\\implies', '\\iff'],     // logical chaining 
    ['\\le', '<', '\\lessim'],  // less 
    ['\\ge', '>', '\\gtrssim'], // greater 
    ['\\equiv', '\\sim', '=']   // equal relation
]