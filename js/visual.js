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
        while(elem !== editor.latex && elem.nodeName !== 'MJX-CONTAINER') {
            elem = elem.parentNode;
        }
        if(elem === editor.latex) return null;
        else return elem;
    }
    static validate_selection(cursor = -1) {
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
        return frag;
    }
    static normalize_selection() {
        if(window.getSelection().rangeCount === 0 || !editor.on_visual_mode) return null;
        let range = window.getSelection().getRangeAt(0), change = null;
        let start = range.startContainer, end = range.endContainer;
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
    static input_handler(e) {
        let r = window.getSelection().getRangeAt(0);
        switch(e.key) {
        case '$':
            Visual.wrap_selection(r);
            break;
        case 'ArrowUp': //will customize later
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
            //tree walker in comming!!!
            setTimeout(Visual.validate_selection, 0);
            return;
        case ' ':
            if(parent.nodeName === 'PRE'&& r.endOffset === parent.firstChild.data.length) {
                parent.insertAdjacentHTML('afterend' , '&nbsp; ');
                r.setStart(parent.nextSibling, 1);
                r.collapse(true);
                Visual.normalize_selection();
                e.preventDefault();
            }
            return;
        default:
            if(e.ctrlKey) setTimeout(Visual.validate_selection, 0);
        }
        auto_complete(e);
        console.log(editor.focus_element);
    }
    static is_text(range) {
        if(range.startContainer !== range.endContainer) return false;
        let node = range.startContainer, child = node.firstChild;
        if(node.nodeName === '#text') return true;
        if(range.startOffset + 2 <= range.endOffset) return false;
        if(!child || (child = node.childNodes[range.startOffset]).nodeName === '#text') {
            if(!child) node.appendChild(document.createTextNode('\u00a0')), child = node.firstChild;
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
        let selected_str = '\u00a0' + r.startContainer.data.slice(r.startOffset, r.endOffset) + '\u00a0';
        let new_select = document.createElement('pre').appendChild(document.createTextNode(selected_str));
        r.deleteContents();
        r.insertNode(new_select.parentNode);
        r.setStart(new_select, 1);
        r.setEnd(new_select, selected_str.length-1);
        Visual.normalize_selection()
    }
    static is_math_only(frag) {
        if(frag.parts.length > 2) return false;
        if(frag.parts.length === 2 && frag.parts[1].str !== '') return false; 
        if(frag.parts[0].type === 'math') return true;
        return false;
    }
    static walk(dir, selection_range) {
        const dir_map = ['firstChild', 'lastChild'];
        switch(dir) {
        case 'ArrowLeft':    
        case 'Arrow Right':
            // move the cursor to the previous/next text content
            
        }
    }
    /**@param {InputEvent} e  */
    static handle_input(e) {
        console.log(e.inputType);
        switch(e.inputType) {
        case 'insertText':
        case 'insertFromPaste':
        case 'insertParagraph':
        case 'deleteContentBackward':
        case 'deleteContentForward':
        case 'historyUndo':
        case 'historyRedo':
        }
    }
}