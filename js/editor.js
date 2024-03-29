/**
 * The editor for writing latex
 */

class Editor {
    
    /**@type {HTMLDivElement} division contain this editor*/
    div;
    /**@type {HTMLInputElement} name of the node */
    name;
    /** @type {NodeUI} The node currently being edited */
    node;
    /**@type {HTMLTextAreaElement} raw text input field*/
    raw;
    /** @type {HTMLDivElement} render latex in this div*/
    latex;
    /**@type {boolean} */
    saved;
    /** @type {boolean} */
    on_visual_mode;
    /** @type {HTMLPreElement} */
    focus_element
    /** when should push into this stack
     * user type more than 10 key stroke in a single pre
     * changing from pre to html and vice versa
     * this only work in visual mode
    */
    history

    /** @param {NodeUI} node  */
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
        else this.inverse_render();
        this.node.raw_text = this.raw.value;
        this.node.rename(this.name.value);
        this.node.html_div.querySelector('.tex_render').innerHTML = this.latex.innerHTML;
    }
    /** @param {?function()} then */
    render(then) {
        this.latex.innerHTML = (new Fragment(this.raw.value, 'text')).output('html').str;
        MathJax.Hub?.Queue(['Typeset', MathJax.Hub, this.latex, then]);
    }
    inverse_render() {
        let range = document.createRange();
        range.setStart(this.latex, 0);
        range.setEnd(this.latex, this.latex.childNodes.length);
        let frag = new Fragment(range, 'html');
        this.raw.value = frag.output('text').str;
    }
    del() {
        if(!window.confirm('Do you want to delete this node ?')) return;
        this.saved = true;
        this.close();
        this.node.remove();
    }
    /**@param {boolean} visual  */
    visual_mode(visual) {
        if(visual) {
            this.raw.style.display = "none";
            this.on_visual_mode = true;
            this.latex.contentEditable = true;
            this.render(() => {
                for(const jax of this.latex.querySelectorAll('script')) Visual.init(jax);
            });
            this.latex.addEventListener('mouseup', Visual.validate_selection);
            this.latex.addEventListener('keydown', Visual.input_handler)
            this.latex.addEventListener('input', () => console.log('invoked'));
        }
        else {
            this.raw.style.display = "";
            this.on_visual_mode = false;
            this.latex.contentEditable = false;
            this.inverse_render();
        }
    }
    /**@param {string} str @param {number} end_offset @param {number} start_offset    */
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
            return {str: sel.anchorNode.data, start: sel.anchorOffset, end: sel.focusOffset};
        }
    }
    /**@param {'b' | 'i' | 'ol' | 'ul' | 'a' | 'rm'} o  */
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
            replace = (o.length == 2 ? '\n':'') + `<${o}>`;
            if(o.length !== 2) replace += selected;
            else {
                replace += '\n  <li> ';
                
                for(const chars of selected) {
                    if(chars === '\n') replace += ' </li>\n  <li> ';
                    else replace += chars;
                }
                replace += ' </li>\n';
            }
            replace += `</${o}>` + (o.length == 2 ? '\n': '');
            start_offset = `<${o}>`.length + (o.length === 2 ? 2: 0);
            end_offset = `</${o}>`.length + (o.length === 2 ? 1: 0);
            break;
        case 'rm':
            for(let j = 0; j < selected.length;) {
                let tag = null;
                if(tag =   Object.keys(tags).find(t => selected.startsWith(t, j))
                        ?? Object.values(tags).find(t => selected.startsWith(t, j)))
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
/**@param {KeyboardEvent} e  */
function auto_complete(e) {
    let {str, start, end} = editor.get_selection();
    if(str === null) return;

    const lookup = Object.assign({'$': '$'}, math_delimeter, {'(':')','[':']','{':'}'}, tags);
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
            if(lookup[open].length == 1) end = start  + replace.length - 2;
            else end = start;
            return editor.insert_and_set(replace, start, end);
        }
        break;
    case '\\':
        // (editor.on_visual_mode ? editor.latex : editor.raw)
        //     .addEventListener('keydown', (e) => console.log('not implemented')); 
        break;
    default:
        break;
    }
}
/**@param {MouseEvent} e  */
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

/**@type {Editor} */
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
    editor.raw.addEventListener('keydown', auto_complete);
    editor.visual_mode(true);
});



//tags that can be use to format the text
const allow_tag = ['b', 'i', 'ol', 'ul', 'li'];
const tags = allow_tag.reduce((acc, name) =>(acc[`<${name}>`] = `</${name}>`,acc) ,{});
const math_delimeter = {'$$':'$$', '$':'$'};
const relations = [
    ['\\implies', '\\iff'],     // logical chaining 
    ['\\le', '<', '\\lessim'],  // less 
    ['\\ge', '>', '\\gtrssim'], // greater 
    ['\\equiv', '\\sim', '=']   // equal relation
]