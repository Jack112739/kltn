"use strict";
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
     * @type{stack: Array<div, range>, pos: int, buffer: int}
    */
    history

    /** @param {NodeUI} node  */
    load(node) {
        if(!node) return;
        if(this.visual_mode) this.history = {stack: new Array(), pos: 0, buffer: 0};
        this.node = node;
        this.saved = true;
        this.name.value = node.header.textContent;
        this.raw.value = node.raw_text;
        this.latex.innerHTML = node.html_div.querySelector('.tex_render').innerHTML;
        this.div.style.animation = "reveal 0.3s ease"
        this.div.parentNode.style.display = "block";
        let readonly = node.is_pseudo || window.MathGraph?.readonly;
        this.name.readOnly = readonly;
        this.latex.contentEditable = !readonly;
        this.raw.readOnly = readonly;
    }
    
    close() {
        let is_save = this.saved && this.name.value === this.node.header.textContent;
        if(!is_save && !window.confirm('Close without saving changes ?')) return;
        this.raw.value = "";
        this.name.value = "";
        this.latex.innerHTML = "";
        this.div.parentNode.style.display = "";
        this.focus_element = null;
        this.node = null;
    }
    save() {
        this.saved = true;
        if(!this.on_visual_mode) this.render();
        else this.inverse_render();
        GraphHistory.register('edit', {
            node: this.node,
            data: this.raw.value, old_data: this.node.raw_text,
            html: this.latex.innerHTML, old_html: this.node.renderer.innerHTML,
            name: this.name.value, old_name: this.node.id,
            new_edge: link_all_references(this.node, this.latex)
        });
        let old = GraphHistory.active;
        GraphHistory.active = true;
        this.node.raw_text = this.raw.value;
        this.node.renderer.innerHTML = this.latex.innerHTML;
        this.node.renderer.style.height = "";
        this.node.renderer.style.width = "";
        this.node.reposition();
        GraphUI.signal(this.node.rename(this.name.value));
        GraphHistory.active = old;
    }
    render() {
        this.latex.innerHTML = '';
        let nodes = (new Fragment(this.raw.value, 'text')).output('html');
        for(const node of nodes) this.latex.appendChild(node);
    }
    inverse_render() {
        if(this.focus_element) Visual.rerender(this.focus_element);
        this.focus_element = null;
        let range = document.createRange();
        range.setStart(this.latex, 0);
        range.setEnd(this.latex, this.latex.childNodes.length);
        this.raw.value = (new Fragment(range, 'html')).output('text');
    }
    del() {
        if(!window.confirm('Do you want to delete this node ?')) return;
        this.saved = true;
        this.node.remove();
        this.close();
    }
    /**@param {boolean} visual  */
    visual_mode(visual) {
        if(visual) {
            this.history = {stack: new Array(), pos: 0, buffer: 0};
            this.raw.style.display = "none";
            this.on_visual_mode = true;
            this.latex.contentEditable = !window.MathGraph.readonly;
            this.render();
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
        let range = window.getSelection().getRangeAt(0);
        let old_offset = this.on_visual_mode ? range.startOffset : this.raw.selectionStart;
        if(!this.on_visual_mode) {
            document.execCommand('insertText', false, str);
            this.raw.selectionStart = old_offset + start_offset;
            this.raw.selectionEnd = old_offset + str.length - end_offset;
        }
        else {
            editor.latex.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: str}));
            range.setStart(range.startContainer, old_offset + start_offset);
            range.setEnd(range.endContainer, old_offset + str.length - end_offset);
        }
    }
    get_selection() {
        if(!this.on_visual_mode) {
            return {str: this.raw.value, start: this.raw.selectionStart, end: this.raw.selectionEnd};
        }
        else {
            Visual.validate_selection();
            let sel = window.getSelection().getRangeAt(0);
            if(sel.startContainer !== sel.endContainer) throw new Error('this should not happen');
            return {str: sel.startContainer.data, start: sel.startOffset, end: sel.endOffset};
        }
    }
    /**@param {'b' | 'i' | 'ol' | 'ul' | 'a' | 'rm'} o  */
    option(o) {
        if(window.MathGraph.readonly) return;
        if(editor.on_visual_mode) {
            let range = new Range(), sel = window.getSelection().getRangeAt(0);
            range.setStart(editor.latex, 0);
            range.setEnd(editor.latex, editor.latex.childNodes.length);
            if(range.compareBoundaryPoints(Range.START_TO_START, sel) > 0) return;
            if(range.compareBoundaryPoints(Range.END_TO_END, sel) < 0) return;
            Visual.wrap_selection();
        }
        let {str, start, end} = editor.get_selection();
        if(str === null) return;
        let selected = str.slice(start, end);
        let replace = '', start_offset = 0, end_offset = 0;
        switch(o) {
        case 'b':
        case 'i':
        case 'ol':
        case 'ul':
            let type = inv_format[o];
            if(o.length === 1) replace = `${type}{${selected}}`;
            else replace = `${type}{\n${selected.split('\n').map(elem => `  \\item ${elem}\n`).join('')}}\n`;
            start_offset = type.length + o.length; //magically correct xD
            end_offset = o.length; 
            break;
        case 'rm':
            let frag = new Fragment(selected, 'text');
            for(let token of frag.parts) if(['open','close','fmt'].includes(token.type)) token.str = '';
            replace = frag.output('text');
            break;
        case 'a':
            let search_for = relations.find(arr => arr.some(str => selected.includes(str)));
            if(!search_for) { GraphUI.signal('no relation found'); return; }
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
        editor.insert_and_set(replace, start_offset, end_offset);
    }
    /**@returns {DOMRect} */
    get_caret_position() {
        if(!this.on_visual_mode) {
            let new_div = document.createElement('div');
            new_div.appendChild(document.createTextNode(this.raw.value))
            for(const [prop, val] of this.raw.computedStyleMap()) {
                new_div.style[prop] = val.toString();
            }
            new_div.style.width = this.raw.offsetWidth + "px";
            new_div.style.height = this.raw.offsetHeight + "px";
            document.body.appendChild(new_div);
            let range = document.createRange();
            range.setStart(new_div.firstChild, this.raw.selectionStart);
            range.setEnd(new_div.firstChild, this.raw.selectionEnd);
            let [input, div, caret] = [this.raw, new_div, range].map(e => e.getBoundingClientRect());
            caret.x += input.x - div.x;
            caret.y += input.y - div.y - this.raw.scrollTop;
            document.body.removeChild(new_div);
            return caret;
        }
        return window.getSelection().getRangeAt(0).getBoundingClientRect();
    }
    popup_menu(lib) {
        let pos = this.get_caret_position();
        let assoc = this.on_visual_mode ? this.latex : this.raw;
        assoc.addEventListener('keydown', Menu.menu_complete);
        Menu.suggest.change_lib(lib)
        Menu.suggest.popup(new PointerEvent('click', {clientX: pos.x, clientY: pos.y}), assoc);
    }
    /**@param {KeyboardEvent} e  */
    auto_complete(e) {
        if(e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') editor.saved = false;
        switch(e.key) {
        case '$':
        case '(':
        case '[':
        case '{':
            let {str, start, end} = editor.get_selection();
            if(str === null) return;
        
            const lookup = {'$': '$' ,'(':')','[':']','{':'}'};
            e.preventDefault();
            let replace = e.key + str.slice(start, end) + lookup[e.key];
            // if it was a close bracket then still select it, otherwise just append text
            if(e.key === '{') {
                let search = Object.keys(format).concat(['\\ref']).find(x => str.endsWith(x, start)) ?? '';
                if(editor.on_visual_mode) {
                    let range = window.getSelection().getRangeAt(0);
                    range.setStart(range.startContainer, range.startOffset - search.length);
                    Visual.wrap_selection();
                    range.setStart(range.startContainer, range.startOffset + search.length);
                }
                if(search === '\\ref') setTimeout(() => {
                    editor.popup_menu(Array.from(window.MathGraph.all_label.keys()).sort());
                    Menu.suggest.load(str.slice(start, end));
                });
            }
            return editor.insert_and_set(replace, 1, 1);
        case '\\':
            editor.popup_menu(mjx_support);
            Menu.suggest.handle_key_event(new KeyboardEvent('keydown', {key: '\\'}));
            break;
        case 'r':
            if(!e.altKey) break;
            if(this.on_visual_mode) this.inverse_render();
            this.render();
            break;
        }
    }
}
/**@param {MouseEvent} e  */
function drag_editor(e) {
    if(!e.target.parentNode.classList.contains('settings')) return;
    e.stopPropagation();
    e.preventDefault();
    let relative_x = editor.div.offsetLeft - e.clientX;
    let relative_y = editor.div.offsetTop - e.clientY, move;

    document.addEventListener('mousemove', move = (e) => {
        document.body.style.cursor = "grabbing";
        editor.div.style.left = e.clientX + relative_x + "px";
        editor.div.style.top = e.clientY + relative_y + "px";
    });
    document.addEventListener('mouseup', (e) => {
        document.body.style.cursor = "";
        document.removeEventListener('mousemove', move);
    }, {once: true});
}
/**@param {NodeUI} node @param {HTMLDivElement} div */
function link_all_references(node, div) {
    let unknow = [];
    let invalid = [];
    let valid = [];
    for(const refs of div.querySelectorAll('mjx-container.ref')) {
        let ref_str = refs.lastChild.textContent.slice('\\ref{'.length, -1);
        let ref_node = window.MathGraph.all_label.get(ref_str), ref_edge;
        if(!ref_node || (ref_edge = node.reference(ref_node)) instanceof String) {
            let pre = document.createElement('pre');
            pre.classList.add('err');
            pre.textContent = refs.lastChild.textContent;
            refs.parentNode.replaceChild(pre, refs);
            if(!ref_node) unknow.push(ref_str);
            else invalid.push(ref_str);
        }
        else valid.push(ref_edge);
    }
    if(unknow.length !== 0) GraphUI.signal(`the nodes to reference: ${unknow.join(', ')}does not exist`);
    if(invalid.length !== 0) GraphUI.signal(`invalid references to nodes ${invalid.join(', ')}`);
    return valid;
}

/**@type {Editor} */
const editor = new Editor();
editor;

document.addEventListener('DOMContentLoaded', () => {
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

    editor.latex.addEventListener('mouseup', Visual.validate_selection);
    editor.latex.addEventListener('keydown', Visual.key_handler);
    editor.latex.addEventListener('beforeinput', Visual.handle_input);
    editor.raw.addEventListener('keydown',e => editor.auto_complete(e));

    editor.div.querySelector('.settings').onmousedown = drag_editor;
    editor.visual_mode(true);
});



//latex formating options
const format = {'\\itemize':'ul','\\item':'li', '\\it':'i', '\\bf':'b', '\\enumurate':'ol'};
const inv_format = {'i':'\\it', 'b':'\\bf', 'li':'\\item', 'ol':'\\enumurate', 'ul':'\\itemize'};
const relations = [
    ['\\implies', '\\iff'],     // logical chaining 
    ['\\le', '<', '\\lessim'],  // less 
    ['\\ge', '>', '\\gtrssim'], // greater 
    ['\\equiv', '\\sim', '=']   // equal relation
]