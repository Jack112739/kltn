class Visual {
    static validate_range() {

    }
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
        let range = Visual.standardize_selection();
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
    }
    static standardize_selection() {
        if(window.getSelection().rangeCount === 0) return null;
        let range = window.getSelection().getRangeAt(0);
        let start = range.startContainer, end = range.endContainer;
        if(start = Visual.is_math_elem(start)) {
            if(start == start.parentNode.firstChild) range.setStart(start.parentNode, 0);
            else range.setStartAfter(start.previousSibling);
        }
        if(end = Visual.is_math_elem(end)) 
            range.setEndAfter(end);
        let need_render = range.startContainer !== range.endContainer 
                        || range.startContainer.nodeName !== '#text';
        if(!editor.focus_element) return need_render ? range: null;
        let cmp_left = range.comparePoint(editor.focus_element, 0);
        let cmp_right = range.comparePoint(editor.focus_element, 1);
        if(cmp_left === 1 || cmp_right === -1) {
            Visual.rerender(editor.focus_element);
            return editor.focus_element = null;
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
        if(!r.collapsed) return;
        switch(e.key) {
        case '$':
            if(r.startContainer.nodeName === '#text') {
                e.preventDefault();
                let new_node = document.createTextNode('$$');
                r.insertNode(new_node);
                new_node = new_node.parentNode;
                r.setStart(new_node.firstChild, 1);
                r.setEnd(new_node.firstChild, 1);
                editor.focus_element = new_node;
                return;
            }
            break;
        case ' ':
            if(r.startContainer.nodeName === '#text' && r.startContainer.data.length === r.endOffset) {
                let cur = r.startContainer, count = 0;
                while(cur !== editor.latex && cur === cur.parentNode.lastChild) {
                    cur = cur.parentNode;
                    count++;
                }
                if(cur === editor.latex && count > 0) {
                    editor.latex.appendChild(document.createTextNode(' '));
                    r.setStart(editor.latex.lastChild.data, 0);
                    r.setEnd(editor.latex.lastChild.data, 0);
                    e.preventDefault();
                }
            }
            break;
        case 'Enter':
            if(r.startContainer.parentNode.nodeName === 'PRE') {
                let data = r.startContainer.data, offset = r.startOffset;
                r.startContainer.data = data.slice(0, r.startOffset) + '\n' + data.slice(r.startOffset);
                r.setEnd(r.startContainer, offset+ 1);
                r.collapse(false);
                e.preventDefault();
            }
        }
        setTimeout(Visual.validate_selection, 0);
        auto_complete(e);
        console.log(editor.focus_element);
    }
}