class Visual {
    /**@param {HTMLScriptElement} jax  */
    static init(jax) {
        if(jax.className === 'checked') return;
        jax.className = 'checked';
        let elem = jax.previousSibling;
        elem.appendChild(jax);
    }
    /**@param {Node} elem  */
    static is_math_elem(elem) {
        if(!elem) return null;
        while(elem !== editor.latex && elem.nodeName !== 'MJX-CONTAINER') {
            elem = elem.parentNode;
        }
        if(elem === editor.latex) return null;
        else return elem;
    }
    static validate_selection(cursor) {
        if(typeof cursor !== 'number') { cursor = -1; }
        let range = Visual.normalize_selection();
        if(!range) return;

        let frag = new Fragment(range, 'html');
        let offset = frag.text_offset();
        if(Visual.is_math_only(frag)) {
            if(cursor < 0) { offset.end += cursor+1; offset.start = offset.end; }
            else { offset.start += cursor; offset.end = offset.start; }
        }
        range.deleteContents();
        editor.focus_element = document.createElement('pre');
        editor.focus_element.append(document.createTextNode(frag.output('text')));
        range.insertNode(editor.focus_element);
        range.setStart(editor.focus_element.firstChild, offset.start);
        range.setEnd(editor.focus_element.firstChild, offset.end);
    }
    static normalize_selection() {
        if(window.getSelection().rangeCount === 0 || !editor.on_visual_mode) return null;
        let range = window.getSelection().getRangeAt(0), change = null;
        let start = range.startContainer, end = range.endContainer;
        if(end === editor.latex && range.endOffset == editor.latex.childNodes.length - 1) {
            editor.latex.appendChild(document.createTextNode('\u200b'));
        }
        if(!editor.latex.contains(start) || !editor.latex.contains(end)) return null;
        if(start = Visual.is_math_elem(start)) {
            if(start == start.parentNode.firstChild) range.setStart(start.parentNode, 0);
            else range.setStartAfter(start.previousSibling);
        }
        if(end = Visual.is_math_elem(end)) 
            range.setEndAfter(end);
        let need_render = !Visual.is_text(range);
        if(range.startContainer.parentNode.nodeName === 'PRE') {
            change = range.startContainer.parentNode;
        }
        if(!editor.focus_element) return need_render ? range: (editor.focus_element = change, null);
        let cmp_left = range.comparePoint(editor.focus_element, 0);
        let cmp_right = range.comparePoint(editor.focus_element, 1);
        if(cmp_left === 1 || cmp_right === -1) {
            Visual.rerender(editor.focus_element);
            return need_render ? range : editor.focus_element = null;
        }
        else if((cmp_left === 0 && cmp_right === 0) || !need_render) 
            return null;
        else
            return range;
    }
    static rerender(elem) {
        let nodes = (new Fragment(elem.firstChild.data)).output('html');
        for(const node of nodes) elem.parentNode.insertBefore(node, elem);
        elem.parentNode.removeChild(elem);
    }
    /**@param {KeyboardEvent} e */
    static key_handler(e) {
        let r = window.getSelection().getRangeAt(0);
        switch(e.key) {
        case '$':
            Visual.wrap_selection(r);
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
            if((r.collapsed || e.shiftKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                Visual.walk(e.key, e.shiftKey, r)
                if(!e.shiftKey) r.collapse(e.key === 'ArrowLeft');
                Visual.validate_selection(cursor_position[e.key])
            }
            else setTimeout(() => Visual.validate_selection(cursor_position[e.key]), 0);
            break;
        case 'z': case 'y':
            if(e.ctrlKey) Visual.history_command(e.key);
        }
        auto_complete(e);
        console.log(editor.focus_element);
    }
    static is_text(range) {
        if(range.startContainer !== range.endContainer) return false;
        let node = range.startContainer, child = node.firstChild;
        if(node.nodeName === '#text') return true;
        if(range.startOffset + 2 <= range.endOffset) return false;
        if(!child || (child = node.childNodes[range.startOffset])?.nodeName === '#text') {
            if(!child) node.appendChild(document.createTextNode('\u200b')), child = node.firstChild;
            range.setStart(child, 0);
            if(range.startOffset !== range.endOffset) range.setEnd(child, child.data.length);
            else range.collapse(true);
            return true;
        }
        return false;
    }
    static wrap_selection() {
        let r = window.getSelection().getRangeAt(0);
        if(r.startContainer.parentNode.nodeName === 'PRE') return;
        let selected_str = r.startContainer.data.slice(r.startOffset, r.endOffset) + '\u200b';
        let new_select = document.createElement('pre').appendChild(document.createTextNode(selected_str));
        r.deleteContents();
        r.insertNode(new_select.parentNode);
        r.setStart(new_select, 0);
        r.setEnd(new_select, selected_str.length);
        Visual.normalize_selection()
    }
    static is_math_only(frag) {
        if(frag.parts.length > 2) return false;
        if(frag.parts.length === 2 && frag.parts[1].str !== '') return false; 
        if(frag.parts[0]?.type === 'math') return true;
        return false;
    }
    /**@param {Boolean} deep @param {'ArrowLeft' | 'ArrowRight'} dir @param {Range} range    */
    static walk(dir, deep, range) {
        let [setrange, dir_left, child, sibling, setrange_relative] = 
            (dir === 'ArrowLeft') ? ['setStart', true, 'lastChild', 'previousSibling', 'setStartBefore']
                                  :['setEnd', false, 'firstChild', 'nextSibling', 'setEndAfter'];
        let parent = range.commonAncestorContainer;
        if(parent.nodeName === '#text') {
            if(dir === 'ArrowLeft' && range.startOffset !== 0) 
                return range.setStart(parent, range.startOffset - 1);
            else if(dir === 'ArrowRight' && range.endOffset !== parent.data.length) 
                return range.setEnd(parent, range.endOffset + 1);
        }
        if(parent.parentNode.nodeName === 'PRE') parent = parent.parentNode;
        if(deep) {
            let is_text = parent.nodeName === '#text' || parent.nodeName === 'PRE';
            if(parent[sibling]) range[setrange](parent[sibling], get_offset(parent[sibling], !dir_left));
            else if(parent.parentNode === editor.latex) return;
            else if(dir === 'ArrowRight') range.setEndAfter(parent.parentNode);
            else range.setStartBefore(is_text ? parent.parentNode : parent);
        }
        else {
            while(parent[sibling] === null && parent !== editor.latex) parent = parent.parentNode;
            if(parent === editor.latex) return; // do nothing
            let target = parent[sibling];
            while(!['MJX-CONTAINER', 'BR', '#text'].includes(target.nodeName)) target=target[child];
            if(target.nodeName === 'BR') range[setrange_relative](target);
            else range[setrange](target, get_offset(target, !dir_left));
        }
    }
    /**@param {InputEvent} e  */
    static handle_input(e) {
        e.preventDefault();
        Visual.validate_selection();
        let range = window.getSelection().getRangeAt(0);
        const buffered = ['insertText', 'insertParagraph', 'deleteContentBackward', 'deleteContentForward'];
        if(e.inputType.startsWith('insert')) {
            let data = e.data ?? e.dataTransfer?.getData('text') ?? '';
            if(e.inputType === 'insertParagraph') data = '\n';
            Visual.change(range, data);
        }
        else if(e.inputType.startsWith('delete')) {
            if(range.collapsed) {
                Visual.walk(e.inputType.endsWith('Forward') ? 'ArrowRight': 'ArrowLeft', true, range);
                Visual.validate_selection();
                if(range.collapsed) return;
                if(e.inputType.endsWith('Forward')) range.setEnd(range.startContainer, range.startOffset + 1);
                else range.setStart(range.endContainer, range.endOffset - 1);
            }
            Visual.change(range, '');
        }
        else return;
        if(!buffered.some(type => e.inputType.startsWith(type))) Visual.history_command('s');
    }
    /** @param {String} data @param {Range} range   */
    static change(range, data) {
        let history = editor.history;
        let change_index = data.length + range.startOffset - range.endOffset;
        if(history.stack.length === 0) Visual.history_command('s');
        if(history.buffer === 0) {
            history.pos ++;
            while(history.stack.length > history.pos) history.stack.pop();
        }
        history.buffer += change_index;
        if(history.buffer > 10 && history.buffer !== change_index) Visual.history_command('s');
        range.deleteContents();
        let start = range.startContainer;
        if(start.parentNode.nodeName !== 'PRE') data = data.replaceAll(' ', '\u00a0');
        if(data === '\n' && start.parentNode.nodeName !== 'PRE') {
            range.insertNode(document.createElement('br'));
            range.setStartAfter(start.nextSibling);
            Visual.validate_selection();
        }
        else if(start.nodeName === '#text' && data.length > 0) {
            let str = start.data, offset = range.startOffset;
            start.data = str.slice(0, offset) + data + str.slice(offset);
            range.setStart(start, offset + data.length);
        }
        else if(data.length > 0) {
            let node = document.createTextNode(data);
            range.insertNode(node);
            range.setStart(node, node.data.length);
        }
        if(range.startContainer.parentNode.nodeName === 'PRE' && range.startContainer.data.length === 0) {
            let old = range.startContainer.parentNode;
            range.setStartAfter(old); 
            old.parentNode.removeChild(old)
            editor.focus_element = null;
        }
        range.collapse(true);
    }
    static history_command(type) {
        let history = editor.history;
        let sel = window.getSelection().getRangeAt(0);
        if(type === 's' || history.buffer !== 0) {
            history.pos = history.stack.length;
            if(history.stack.length === HISTORY_MAX) history.stack.shift();
            history.stack.push(Visual.clone_img({
                div: editor.latex, 
                focus: editor.focus_element,
                start: sel.startContainer, startOffset: sel.startOffset,
                end: sel.endContainer, endOffset: sel.endOffset
            }));
        }
        history.buffer = 0;
        if(type === 's') return;
        if(history.pos === 0 && type === 'z') return;
        else if(history.pos == history.stack.length - 1 && type === 'y') return;
        history.pos += type == 'z' ? -1 : 1;
        let clone = Visual.clone_img(history.stack[history.pos]);
        editor.latex.innerHTML = '';
        while(clone.div.firstChild) editor.latex.appendChild(clone.div.firstChild);
        sel.setStart(clone.start === clone.div ? editor.latex : clone.start, clone.startOffset);
        sel.setEnd(clone.end === clone.div ? editor.latex : clone.end, clone.endOffset);
        editor.focus_element = clone.focus;
    }
    static clone_img(image) {
        let clone = image.div.cloneNode(true);
        let get_respected = (elem) => {
            if(!elem) return null;
            if(elem === image.div) return clone;
            let parent = get_respected(elem.parentNode);
            let index = Array.from(elem.parentNode.childNodes).indexOf(elem);
            return parent.childNodes[index];
        }
        return {
            div: clone,
            focus: get_respected(image.focus),
            start: get_respected(image.start), startOffset: image.startOffset,
            end: get_respected(image.end), endOffset: image.endOffset
        };
    }
}
/** @param {Node} node  */
function get_offset(node, left) {
    if(left) return 0;
    return node.nodeName === '#text' ? node.data.length : node.childNodes.length;
}
const cursor_position = {'ArrowUp' : -1, 'ArrowDown': 0, 'ArrowLeft': -2, 'ArrowRight': 1};
const HISTORY_MAX = 4096;