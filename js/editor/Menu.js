"use strict";

class Menu {

    /**@type {HTMLUListElement} the Node representation */
    items;
    /**@type {HTMLLIElement} the node user is hovering */
    highlighted = null;
    /**@type {Array<String>?} lazy added items in this list*/
    library;
    /**@type {{str: string, span: Array<string>}} the search object, if this menu is the suggest menu */
    search = {str: '', span: []}
    /** @type {?(HTMLLIElement) => any} keyboard call back*/
    invoke;
    /** @type {any} */
    associate = null;

    /**@param {HTMLUListElement | Array<String>} items , @param {?(HTMLLIElement) => any} invoke */
    constructor(items, invoke) {
        if(items instanceof HTMLUListElement) {
            this.items = items;
            for(const node of items.childNodes) if(node.nodeName !== 'LI') items.removeChild(node);
            this.library = null;
            this.items.onclick = (e) => this.hide();
        }
        else {
            this.items = document.createElement('ul');
            this.items.className = "menu"
            this.library = items;
            this.load("");
        }
        if(invoke) this.items.addEventListener('click', (e) => {invoke(this.highlighted); this.hide(); });
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
        if(this.associate instanceof Node) this.associate.removeEventListener('keydown', Menu.menu_complete);
        this.associate = null;
        this.search = {str: '', span: ''};
        this.items.style.display = "none";
    }

    /**@param {PointerEvent} e  */
    popup(e, associate) {
        this.items.style.display = "";
        this.associate = associate;
        document.addEventListener('click', (e) => { 
            if(!this.items.contains(e.target)) this.hide()

        }, {once: true, capture: true});
        let viewpoint = document.body.getBoundingClientRect();
        this.items.style.left = `${e.clientX - viewpoint.left}px`;
        this.items.style.top = `${e.clientY - viewpoint.top + 20}px`;
        let item_layout = this.items.getBoundingClientRect();
        if(item_layout.right > viewpoint.width) {
            this.items.style.left = (-viewpoint.x + e.clientX - this.items.offsetWidth) + "px";
        }
        if(item_layout.bottom > viewpoint.height) {
            this.items.style.top = (-viewpoint.y + e.clientY - this.items.offsetHeight - 20) + "px";
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
    /**@param {Array<string>} lib */
    change_lib(lib) {
        this.library = lib;
        this.search = {str: 0, span: []};
        this.load("");
    }
    /** @param {string} text  */
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
        if(this.items.childNodes.length === 0) this.hide();
    }
    static menu_complete = (e) => Menu.suggest.handle_key_event(e);
    
    /**@type { Menu} */
    static suggest = null;
    /** @type { Menu} */
    
    static node = null;
    /** @type {Menu} */
    static edge = null;
    /**@type {Menu} */
}

document.addEventListener('DOMContentLoaded', () => {
    Menu.suggest = new Menu(mjx_support, (li) => {
        let insert = li.textContent, adjust = insert.length;
        if(insert.startsWith('\\begin{')) {
            let env = insert.slice('\\begin{'.length, -1);
            insert = `\\begin{${env}}  \\end{${env}}`;
            adjust = env.length + "\\begin{}".length;
        }
        insert = insert.slice(Menu.suggest.search.str.length);
        adjust -= Menu.suggest.search.str.length;
        editor.insert_and_set(insert, adjust, insert.length - adjust);
    });
    Menu.suggest.hide();
    document.body.appendChild(Menu.suggest.items);

})
function binary_search(start, end, arr, search) {
    if(start == end) return start;
    let mid = Math.floor((start + end) / 2);
    if(search > arr[mid]) return binary_search(mid+1, end, arr, search);
    else return binary_search(start, mid, arr, search);
}