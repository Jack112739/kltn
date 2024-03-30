class Menu {

    /**@type {HTMLUListElement} the Node representation */
    items;
    /**@type {HTMLLIElement} the node user is hovering */
    highlighted = null;
    /**@type {Array<String>?} lazy added items in this list*/
    library;
    /**the search object, if this menu is the suggest menu */
    search = {str: null, span: []}
    /** @type {?(HTMLLIElement) => any} keyboard call back*/
    invoke;

    /**@param {HTMLUListElement | Array<String>} items , @param {?(HTMLLIElement) => any} invoke */
    constructor(items, invoke) {
        if(items instanceof HTMLUListElement) {
            this.items = items;
            for(const node of items.childNodes) if(node.nodeName !== 'LI') items.removeChild(node);
            this.library = null;
        }
        else {
            this.items = document.createElement('ul');
            this.items.className = "menu"
            this.library = items;
            this.load("");
        }
        if(invoke) this.items.addEventListener('click', (e) => this.hide(invoke(this.highlighted)));
        this.invoke = invoke ?? ((li) => li.onclick());
        this.items.addEventListener('mouseover', (e) => {
            let target = e.target;
            if(target === this.items) return;
            while(target.nodeName !== 'LI') target = target.parentNode;
            this.set_highlight(target);  
        })
        this.items.addEventListener('scroll', (e) => this.load());
    }

    hide() {
        this.search = {str: '', span: ''};
        this.items.style.display = "none";
    }

    /**@param {PointerEvent} e  */
    popup(e) {
        this.items.style.display = "";
        document.addEventListener('click', (e) => this.hide(), {once: true, capture: true});
        let viewpoint = document.documentElement.getBoundingClientRect();
        this.items.style.left = `${e.clientX - viewpoint.left}px`;
        this.items.style.top = `${e.clientY - viewpoint.top }px`;
        let item_layout = this.items.getBoundingClientRect();
        if(item_layout.right > viewpoint.width) {
            this.items.style.top = viewpoint.x + e.clientX - this.items.offsetWidth;
        }
        if(item_layout.bottom > viewpoint.height) {
            this.items.style.top = viewpoint.y + e.clientY - this.items.offsetHeight;
        }
    }
    /**@param {HTMLLIElement} elem  */
    set_highlight(elem) {
        if(elem === this.highlighted) return;
        if(this.highlighted) this.highlighted.classList.remove('highlight');
        this.highlighted = elem;
        if(!elem) return;
        this.highlighted.classList.add('highlight');
        let diff = this.items.offsetHeight - this.highlighted.offsetHeight;
        if(this.highlighted.offsetTop < this.items.scrollTop) {
            this.items.scrollTop = this.highlighted.offsetTop;
        }
        else if(this.highlighted.offsetTop > this.items.scrollTop + diff) {
            this.items.scrollTop = this.highlighted.offsetTop - diff;
        }
    }
    /**@param {KeyboardEvent} e */
    handle_key_event(e) {
        if(this.items.style.display === "none") return;
        switch(e.key) {
        case 'ArrowUp':
            e.preventDefault();
            if(this.highlighted.previousSibling?.style.display === "none") 
                this.set_highlight(this.highlighted.previousSibling)
            if(this.highlighted.previousSibling) this.set_highlight(this.highlighted.previousSibling);
            return;
        case 'ArrowDown':
            e.preventDefault();
            if(this.highlighted.nextSibling?.style.display === "none")
                this.set_highlight(this.highlighted.nextSibling);
            if(this.highlighted.value === this.items.childNodes.length - 1) this.load();
            if(this.highlighted.nextSibling) this.set_highlight(this.highlighted.nextSibling);
            return;
        case 'Enter': case 'Tab':
            e.preventDefault();
            this.invoke(this.highlighted);
            this.hide();
            return;
        case 'Backspace':
            if(this.search.str.length === 1) return this.hide();
            return this.load(this.search.str.slice(0, -1));
        case 'Escape':
            return this.hide();
        default:
            if(e.key.length !== 1) return;
            return Menu.suggest.load(Menu.suggest.search.str += e.key);
        }
    }
    load(text) {
        if(!this.library) return;
        if(text !== undefined && text !== null) {
            this.items.innerHTML = '';
            this.search.str = text;
            let start_offset = binary_search(0, this.library.length, this.library, text);
            let end_offset = binary_search(0, this.library.length, this.library, text + "~~~~~");
            this.search.span = this.library.slice(start_offset, end_offset);
            if(this.search.span.length === 0) return this.hide();
        }
        let count = this.items.childNodes.length;
        let thresh_hold = 0;
        if(this.items.lastChild) thresh_hold = this.items.lastChild.offsetTop - this.items.offsetHeight;
        if(this.items.scrollTop < thresh_hold) return;
        for(let i = 0; i < 25; i++) {
            let insert = this.search.span[i + count];
            if(insert) this.items.insertAdjacentHTML('beforeend', 
                `<li><b>${this.search.str}</b>${insert.slice(this.search.str.length)}</li>`);
        }
        if(text !== null && text !== undefined) this.set_highlight(this.items.firstChild);
    }
    
    static suggest = null;
    static rightclicked = null;
    static ref_node = null;
}

document.addEventListener('DOMContentLoaded', () => {
    Menu.rightclicked = new Menu(document.getElementById('rightclick'));
    let menu = Menu.rightclicked.items.childNodes;
    menu[EDIT].onclick = (e) => editor.load(Menu.ref_node);
    menu[MAX].onclick = (e) => Menu.ref_node.html_div.querySelector('.tex_render').style.display = "";
    menu[MIN].onclick = (e) => Menu.ref_node.html_div.querySelector('.tex_render').style.display = "none";
    menu[DETAIL].onclick = (e) => Menu.ref_node.html_div.ondblclick();
    menu[REF].onclick = (e) => GraphUI.new_edge(Menu.ref_node, e);
    menu[RENAME].onclick = (e) => {
        let input = document.createElement('input');
        let viewpoint  = document.documentElement.getBoundingClientRect();
        Menu.rightclicked.items.style.display = "";
        let position = Menu.rightclicked.highlighted.getBoundingClientRect();
        Menu.rightclicked.hide();
        input.className = "rename";
        input.value = Menu.ref_node.id;
        input.style.left = `${position.left - viewpoint.left}px`;
        input.style.top = `${position.top - viewpoint.top }px`;
        document.body.appendChild(input);
        input.focus();
        input.addEventListener('focusout', () => document.body.removeChild(input));
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') Menu.ref_node.rename(input.value), input.style.display = "none";
        });
    };
    menu[REMOVE].onclick = (e) => {
        if(window.confirm(`Do you want to delete ${Menu.ref_node.id}?`)) Menu.ref_node.remove();
    }
    Menu.suggest = new Menu(mjx_support, (li) => {
        let insert = li.textContent, adjust = 0;
        if(insert.startsWith('\\begin{')) {
            let env = insert.slice('\\begin{'.length, -1);
            insert = `\\begin{${env}}  \\end{${env}}`;
            adjust = env.length + "\\ end{}".length;
        }
        document.execCommand('insertText', false, insert.slice(Menu.suggest.search.str.length));
        let range = window.getSelection().getRangeAt(0);
        range.setStart(range.startContainer, range.startOffset - adjust);
        range.collapse(true);
    });
    Menu.suggest.hide();
    document.body.appendChild(Menu.suggest.items);

})
const EDIT = 0, MIN = 1, MAX = 2, DETAIL = 3, REF = 4, RENAME = 5, REMOVE = 6;

function binary_search(start, end, arr, search) {
    if(start >= end) return search == arr[end-1] ? end - 1 : end;
    let mid = Math.floor((start + end) / 2);
    if(search >= arr[mid]) return binary_search(mid + 1, end, arr, search);
    else return binary_search(start, mid, arr, search);
}