class VisualEditor {
    static reveal(elem, cursor) {
        if(!elem || !(elem = VisualEditor.is_math_element(elem))) return null;
        let raw_math = document.createElement('pre');
        let delim = elem.math_info.display ? '$$' : '$';
        raw_math.appendChild(document.createTextNode(delim + elem.math_info.str + delim));
        raw_math.className = "editing";
        elem.replaceWith(raw_math);
        if(cursor < 0) cursor = raw_math.firstChild.length + cursor + 1;
        setTimeout(() => set_selection(raw_math.firstChild, cursor, cursor));
        return raw_math;
    }
    static rerender(elem) {
        if(!elem) return;
        let start = 0, end = 0;
        while(elem.firstChild.data[start] == '$' && start <= 2) start++;
        while(elem.firstChild.data[elem.firstChild.data.length - end - 1] == '$' && end <= 2) end++;
        if(start != end) {
            elem.style.textDecoration = "red wavy underline";
        }
        else if(start == 0) {
            elem.replaceWith(elem.firstChild);
        }
        else {
            let jax = document.createElement('script');
            jax.innerHTML = elem.firstChild.data.slice(start, -end);
            jax.type = "math/tex";
            if(start === 2) jax.type += "; mode=display";
            elem.replaceWith(jax);
            MathJax.Hub.Queue(['Typeset', MathJax.Hub, jax, () => VisualEditor.init(jax)]);
        }

    }
    static broke(elem) {

    }
    static init(jax) {
        let elem = jax.previousSibling;
        elem.math_info = {
            str: jax.firstChild.data,
            display: jax.type.includes('display')
        };
        elem.parentNode.removeChild(jax);
        elem.preventDefault.removeChild(elem.previousSibling);
    }
    static rerender_when_focusout(e) {
        if(e.target === editor.focus) return;
        VisualEditor.rerender(editor.focus);
        if(e.target.className.includes('editing')) editor.focus = e.target; 
        else editor.focus = null;
    }
    static keydown_handler(e) {
        
        let selection = window.getSelection();
        switch(e.key) {
        case '$':
            e.preventDefault();
            if(selection.anchorNode !== selection.focusNode) {
                document.execCommand('insertText', false, '$$');
                VisualEditor.merge(selection.anchorNode, selection.focusNode);
                return;
            }
            break;
        case 'Delete':
        case 'Backspace':
            e.preventDefault();
            
            SetTimeout(() => VisualEditor.merge(selection.anchorNode, selection.focusNode), 0);
            break;
        case 'ArrowUp': 
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowDown':
            setTimeout(() => {
                let focus = selection.focusNode;
                if(focus.parentNode === editor.focus) return;
                
                VisualEditor.rerender(editor.focus);
                for(; focus !== editor.latex; focus = focus.parentNode) {
                    if(focus.nextSibling?.tagName === 'SCRIPT') {
                        return editor.focus = focus.reveal(focus, cursor_offset[e.key]);
                    }
                }
                editor.focus = null;
            }, 0);
            break;
        default:
            break;
        }
        SuggestMenu.auto_complete(e);
    }
    static is_math_element(e) {
        while(!e.math_info && e != editor.latex) e = e.parentNode;
        if(e == editor.latex) return null;
        return e;
    }
    static preprocess(node, offset, common, forward) {
        if(node.nodeName === '#text') {
            if((forward && offset != 0) || (!forward && offset == node.data.length)) {
                return {node: node, offset: offset};
            }
        }
        else {
            node = node.childNodes[offset - (forward ? 0 : 1)];
        }
        node = VisualEditor.is_math_element(node) ?? node;
        let go = forward ? 'firstChild' : 'lastChild';
        while(node !== common) {
            if(node !== node.parentNode[go]) break;
            node = node.parentNode;
        }
        return {node: node, offset: 0};
    }
    static get_fragment() {
        let range = window.getSelection().getRangeAt(0);
        let start = VisualEditor.preprocess(range.startContainer, range.startOffset, 
            range.commonAncestorContainer, true);
        let end = VisualEditor.preprocess(range.endContainer, range.endOffset,
            range.commonAncestorContainer, false);
        return new Fragment({start: start, end: end}, true);
    }
    static insert_fragment(frag) {
        let range = document.createRange();
        if(frag.start.nodeName === '#text') range.setStart(frag.start.node, frag.start.offset);
    }
}

const cursor_offset = {'ArrowUp': -1, 'ArrowRight': 1, 'ArrowLeft': -2, 'ArrowDown': 0};
const delete_type = {'Backspace': 'delete', 'Delete': 'forwardDelete'};