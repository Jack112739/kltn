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
    //input element we are editing on
    edit_on;

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
        let html_string = '', raw = this.raw.value;
        let stack = new Array();
        for(let i = 0; i < raw.length; i++) {
            switch(raw[i]) {
            case '<':
                let advance = '&lt';
                for(let j = 0; j < allow_open.length; j++) {
                    if(raw.startsWith(allow_open[j], i)) {
                        advance = allow_open[j];
                        stack.push(j);
                    }
                    else if(raw.startsWith(allow_close[j], i)) {
                        advance = allow_close[j];
                        let id = stack.pop();
                        if(id && id != j) {
                            window.alert(`expect close tag for ${allow_open[j]}, found ${allow_close[j]}`);
                            throw new Error(`HTML parse error, wrong close tag`);
                        }
                    }
                }
                html_string += advance;
                i += advance[0] == '&' ? 0 : advance.length-1;
                break;
            case '>':  html_string += '&gt;'; break;
            case '&':  html_string += '&amp;'; break;
            case '\'': html_string += '&apos;'; break;
            case '\"': html_string += '&quot;'; break;
            default:   html_string += raw[i]; break;
            }
        }
        if(stack.length != 0) {
            window.alert(`missing close tag for ${allow_open[stack.pop()]}`);
            throw new Error(`HTML parse error, missing close tag`);
        }
        this.latex.innerHTML = html_string;
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
            this.raw.onblur = format_or_blur;
            this.raw.onclick = (e) => this.edit_on = this.raw;
        }
    }
    
}
// this function need to be called to prevent an input from being blur if we click the format button
function format_or_blur(e) {
    if(e.relatedTarget?.tagName == 'BUTTON' && editor.div.contains(e.relatedTarget)) {
        e.preventDefault();
        return;
    }
    editor.edit_on = null;
}
function option(o) {
    let input = editor.edit_on;
    if(!input) return;

    let start = input.selectionStart, end = input.selectionEnd;
    let selected = input.value.slice(start, end);
    switch(o) {
    case 'b':
    case 'i':
    case 'ol':
    case 'ul':{
        let replace = `<${o}>`;
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
        document.execCommand('insertText', false, replace);
        input.selectionStart = start + `<${o}>`.length + (o.length == 2 ? 1: 0);
        input.selectionEnd = start + replace.length - `</${o}>`.length;
        }break;
    case 'e':{
        let replace = `\n\\begin{}\n  ${selected}\n\\end{}\n`;
        document.execCommand('insertText', false, replace);
        input.selectionStart = start +  '\n$$\\begin{'.length;
        input.selectionEnd = input.selectionStart;
        }break;
    case 'a':{
        let search_for = relations.find(arr => arr.some(str => selected.includes(str)));
        if(!search_for) break;
        // = can also be used in those type of comparison
        if(search_for[0] !== '\\implies') search_for.push('=');

        let replace = '\n\\begin{align*}\n  &';
        for(let i = 0; i < selected.length; i++) {
            if(search_for.some(str => selected.startsWith(str, i))) {
                replace += '\\\\\n  &';
            }
            replace += selected[i];
        }
        replace += '\\\\\n\\end{align*}\n';
        input.selectionStart = start + '\n\\begin{align*}\n'.length;
        input.selectionEnd = start + replace - '\n\\end{align*}\n'.length;
        document.execCommand('insertText', false, replace);
        }break;
    default:
        throw new Error('text edit option is not supported')
    }
}
function auto_complete(e) {
    let input = editor.edit_on;
    if(!input) return;

    const open = ['$', '\\[', '\\(', '(', '[', '\\begin{', '{'];
    const close = ['$', '\\]', '\\)', ')', ']', '}\\end{}', '}'];
    let start = input.selectionStart, end = input.selectionEnd;
    let op = open, cl = close;
    switch(e.key) {
    case '>':
        op = allow_open;
        cl = allow_close;
        //fallthrough
    case '$':
    case '(':
    case '[':
    case '{':
        let candidate = input.value.slice(start - 10, start) + e.key;
        for(let i = 0; i < op.length; i++) if(candidate.endsWith(op[i])) {
            e.preventDefault();
            let replace = e.key + (cl[i].length == 1 ? input.value.slice(start, end): '') + cl[i];
            document.execCommand('insertText', false, replace);
            input.selectionStart = start + 1;
            // if it was a close bracket then still select it, otherwise just append text
            if(cl[i].length == 1) input.selectionEnd = start + replace.length - 1;
            else input.selectionEnd = input.selectionStart;
            return;
        }
        break;
    case '\\':
        input.addEventListener('keydown', (e) => console.log('not implemented')); 
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
    editor.div.querySelector('.bold').onclick = () => option('b');
    editor.div.querySelector('.italic').onclick = () => option('i');
    editor.div.querySelector('.align').onclick = () => option('a');  
    editor.div.querySelector('.ol').onclick = () => option('ol');
    editor.div.querySelector('.ul').onclick = () => option('ul');
    editor.div.querySelector('.env').onclick = () => option('e');
    editor.div.querySelector('.mode').onchange = (e) => editor.visual_mode(e.target.checked);

    editor.div.querySelector('.settings').onmousedown = drag_editor;
    editor.visual_mode(true);
});



//tags that can be use to format the text
const allow_open =  ['<b>',   '<i>',   '<li>',   '<ol>',   '<ul>']
const allow_close = ['</b>', '</i>', '</li>', '</ol>', '</ul>'];
const relations = [
    ['\\implies', '\\iff'],     // logical chaining 
    ['\\le', '<', '\\lessim'],  // less 
    ['\\ge', '>', '\\gtrssim'], // greater 
    ['\\equiv', '\\sim', '=']   // equal relation
]