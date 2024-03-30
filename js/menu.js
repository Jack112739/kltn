class Menu {

    /**@type {HTMLUListElement} the Node representation */
    items;
    /**@type {HTMLLIElement} the node user is hovering */
    highlighted;
    /**@type {Array<String>} lazy added items in this list*/
    library; 

    /**@param {HTMLUListElement | Array<String>} items */
    constructor(items) {
        if(items instanceof HTMLUListElement) {
            this.items = items;
            for(const node of items.childNodes) if(node.nodeName !== 'LI') items.removeChild(node);
            this.library = null;
        }
        else {
            this.items = document.createElement('ul');
            this.refresh(items);
        }
        this.items.tabIndex = 0;
        this.items.addEventListener('mouseover', (e) => {
            this.items.focus();
            let target = e.target;
            if(target === this.items) return;
            // this loop like 2 times or so, but yeah
            while(target.nodeName !== 'LI') target = target.parentNode;
            this.set_highlight(target);  
        })
        this.items.addEventListener('keydown', (e) => this.handle_key_event(e))
        this.items.addEventListener('scroll', (e) => this.load());
    }

    hide() {
        this.items.style.display = "none";
    }

    /**@param {PointerEvent} e  */
    popup(e) {
        if(!this.items.parentNode) document.body.appendChild(this.items);
        this.items.style.display = "";
        this.items.focus();
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
    refresh(list) {
        this.highlighted = null;
        this.library = list;
        this.items.innerHTML = '';
        for(let i = 0; i < 25; i++) this.items.insertAdjacentHTML(`<li>${list[i]}</li>`);
    }
    /**@param {KeyboardEvent} e */
    handle_key_event(e) {
        e.preventDefault();
        switch(e.key) {
        case 'Enter':
            this.hide()
            return  this.highlighted.onclick();
        case 'ArrowUp':
            if(this.highlighted.previousSibling) this.set_highlight(this.highlighted.previousSibling);
            return;
        case 'ArrowDown':
            if(this.highlighted.value === this.items.childNodes.length - 1) this.load();
            if(this.highlighted.nextSibling) this.set_highlight(this.highlighted.nextSibling);
        }
    }
    load() {
        if(!this.library) return;
        let count = this.childNodes.length;
        for(let i = 0; i < 25; i++) this.items.insertAdjacentHTML(`<li>${items[i + count]}</li>`);
    }
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
        Menu.rightclicked.hide();
        let input = document.createElement('input');
        let viewpoint  = document.documentElement.getBoundingClientRect();
        input.className = "rename";
        input.value = Menu.ref_node.id;
        input.style.left = `${e.clientX - viewpoint.left}px`;
        input.style.top = `${e.clientY - viewpoint.top }px`;
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
})
const EDIT = 0, MIN = 1, MAX = 2, DETAIL = 3, REF = 4, RENAME = 5, REMOVE = 6;