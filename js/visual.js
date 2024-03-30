class Visual {
    /**@param {HTMLDivElement} jax  */
    static init(jax) {
        let elem = jax.previousSibling;
        elem.math_info = {type: jax.type, str: jax.firstChild.data};
        elem.parentNode.removeChild(jax);
        elem.parentNode.removeChild(elem.previousSibling);
        elem.addEventListener('selectstart', () => Visual.validate_selection());
    }
    /**@param {Node} elem  */
    static is_math_elem(elem) {
        while(elem !== editor.latex && !elem.math_info) {
            elem = elem.parentNode;
        }
        if(elem === editor.latex) return null;
        else return elem;
    }
    static validate_selection() {
        let range = Visual.normalize_selection();
        if(!range) return;

        let frag = new Fragment(range, 'html');
        let info = frag.output('text');
        if(frag.parts.length === 2 && info.str[0] === '$' && frag.parts[1].str == '') 
            info.start = info.end;
        range.deleteContents();
        editor.focus_element = document.createElement('pre');
        editor.focus_element.append(document.createTextNode(info.str));
        range.insertNode(editor.focus_element);
        range.setStart(editor.focus_element.firstChild, info.start);
        range.setEnd(editor.focus_element.firstChild, info.end);
        return frag;
    }
    static normalize_selection() {
        if(window.getSelection().rangeCount === 0) return null;
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
        let frag = new Fragment(elem.firstChild.data);
        elem.insertAdjacentHTML('afterend', frag.output('html').str);
        elem.parentNode.removeChild(elem);
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, editor.latex, () => {
                for(const jax of editor.latex.querySelectorAll('script')) Visual.init(jax);
        }])
    }
    /**@param {KeyboardEvent} e */
    static input_handler(e) {
        let r = window.getSelection().getRangeAt(0);
        let parent = r.startContainer.parentNode;
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
        case 'Delete':
        case 'Backspace':
            // prevent weird behavior
            break;
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
            if(!child) node.appendChild(document.createTextNode('')), child = node.firstChild;
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
}