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
        const allow =  ['<b>',   '<i>',   '<li>',   '<ol>',   '<ul>',
                        '</b>', '</i>', '</li>', '</ol>', '</ul>'];
        let html_string = new String(), raw = this.raw.value;
        let stack = new Array();
        for(let i = 0; i < raw.length; i++) {
            switch(raw[i]) {
            case '<':
                let advance = 0;
                for(let j = 0; j < 5; j++) {
                    if(raw.startsWith(allow_open[j])) {
                        advance = allow_open[i].length - 1;
                        stack.push(j);
                    }
                    else if(raw.startsWith(allow_close[j])) {
                        advance = allow_open[i].length - 1;
                        let id = stack.pop();
                        if(id && id != j) {
                            window.alert(`expect close tag for ${allow_open[j]}, found ${allow_close[j]}`);
                            throw new Error(`HTML parse error, wrong close tag`);
                        }
                    }
                }
                if(advance == 0) html_string += '&lt';
                i += advance;
                break;
            case '>':  html_string += '&gt'; break;
            case '&':  html_string += '&amp'; break;
            case '\'': html_string += '&apos'; break;
            case '\"': html_string += '&quot'; break;
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
    mode(visual) {
        if(visual) {    
            this.raw.style.display = "none";
            this.latex.contentEditable = true;
            this.edit_on = null;
        }
        else {
            this.edit_on = this.raw;
            this.raw.style.display = "flex";
            this.latex.contentEditable = false;
        }
    }
    // options for manipulating the text
    
}
function option(o, input) {
    if(!input) return;
    let start = input.selectionStart, end = input.selectionEnd;
    switch(o) {
    case 'b':
    case 'i':
    case 'ol':
    case 'ul':
        input.setRangeText(`<${o}>${input.value.slice(start,end)}</${o}>`, start, end, 'select');
        if(o.length === 2) {
            let replace = '\n  <li> ';
            start  += 4; end += 4;
            for(const chars of input.value.slice(start, end)) {
                if(chars === '\n') replace += ' </li>\n  <li> ';
                else replace += chars;
            }
            replace += ' </li>\n';
            input.setRangeText(replace, start, end);
        }
        break;
    case 'e':
        input.setRangeText(` $$\\begin{}   \\end{}$$ `, start,end);
        input.selectionStart += '$$\\begin{'.length;
        break;
    case 'a':
        break;
    default:
        throw new Error('text edit option is not supported')
    }
}
function auto_complete(e, input) {
    if(e.inputType != 'insertText') return;

    const open = ['$', '\\[', '\\(', '(', '[', '\\begin{', '{'];
    const close = ['$', '\\]', '\\)', ')', ']', '}\\end{}', '}'];
    let pos = input.selectionStart;
    let op = open, cl = close;
    switch(e.data) {
    case '>':
        op = allow_open;
        cl = allow_close;
        tag = undefined;
        //fallthrough
    case '$':
    case '(':
    case '[':
    case '{':
        let candidate = input.value.slice(pos - 20, pos);
        for(let i = 0; i < op.length; i++) if(candidate.endsWith(op[i])) {
            input.setRangeText(cl[i], pos, pos);
            e.preventDefault();
            return;
        }
        break;
    default:
        break;
    }
}
function action_suggest_menu(e, input) {

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


var editor, suggest = null;

document.addEventListener('DOMContentLoaded', () => {
    editor = new Editor();
    editor.div = document.getElementById('editor');
    editor.name = editor.div.querySelector('input.name');
    editor.raw = editor.div.querySelector('.raw-text');
    editor.latex = editor.div.querySelector('.latex');
    
    editor.div.querySelector('.close').onclick = () => editor.close();
    editor.div.querySelector('.save').onclick = () => editor.save();
    editor.div.querySelector('.del').onclick = () => editor.del();
    editor.div.querySelector('.bold').onclick = () => option('b', editor.edit_on);
    editor.div.querySelector('.italic').onclick = () => option('i', editor.edit_on);
    editor.div.querySelector('.align').onclick = () => option('a', editor.edit_on);  
    editor.div.querySelector('.ol').onclick = () => option('ol', editor.edit_on);
    editor.div.querySelector('.ul').onclick = () => option('ul', editor.edit_on);
    editor.div.querySelector('.env').onclick = () => option('e', editor.edit_on);
    editor.div.querySelector('.mode').onchange = (e) => editor.mode(e.target.checked);

    editor.div.querySelector('.settings').onmousedown = drag_editor;
    editor.div.querySelector('.raw-text').oninput= (e) => auto_complete(e, editor.raw);
});



//tags that can be use to format the text
const allow_open =  ['<b>',   '<i>',   '<li>',   '<ol>',   '<ul>']
const allow_close = ['</b>', '</i>', '</li>', '</ol>', '</ul>'];