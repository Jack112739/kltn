"use strict";
class EdgeUI {

    /**@type {LeaderLine>} sometime work as a shared pointer, count odd = owned, count/2 = borrow*/
    repr;
    /**@type {NodeUI} the parent of where this node was stolen from */
    from;
    /**@type {NodeUI} */
    alias
    /** @type {NodeUI[]} */
    hierarchy;
    /**@type {number} */
    offset_to;
    /**@type {number} */
    offset_from;
    /**@type {NodeUI?} appear when we want to shorten the proof */
    truncate;

    /**@param {NodeUI} from @param {NodeUI} to */
    constructor(from, to) {
        this.from = from.is_pseudo ? from.ref : from;
        this.alias = from;
        this.offset_to = 0;
        this.offset_from = 0;
        from.math.to.set(to, this);
        this.from.math.to.set(to, this);
        to.math.from.set(this.from, this);
        this.hierarchy = [];
        for(let cur = to; cur !== this.from.parent; cur = cur.parent) {
            if(cur.parent === from.parent) this.offset_from = this.hierarchy.length;
            this.hierarchy.push(cur);
            cur.external_ref.add(this);
        }
        //TODO : create some explaination for this (automatically ?)
        this.truncate = null;
        if(!window.MathGraph.is_parsing)  this.change_to_fit(this.offset_to, 'auto');
    }
    /**@param {NodeUI} to */
    adjust_svg() {
        let screen = document.documentElement.getBoundingClientRect();
        let actual = this.stored.getBoundingClientRect();
        let dx = actual.x - this.stored.scrollLeft - screen.x;
        let dy = actual.y - this.stored.scrollTop - screen.y;
        this.repr.svg.setAttribute('transform', `translate(${-dx}, ${-dy})`);
    }
    // if the start plug is not rendered correctly
    refresh() {
        /** @type {NodeUI} */
        let current = window.MathGraph.current;
        if(this.from.is_truncated || this.to === current) return;
        if(this.from.ref && this.from.ref.parent !== current) {
            EdgeUI.reclaim_edges(this.from.ref);
        }
        if(!this.from.ref) EdgeUI.create_pseudo(this.from);
        if(this.alias === this.from.ref) return; 
        this.alias = this.from.ref;
        this.from.ref.math.to.set(this.to, this);
        this.offset_from = 0;
        while(this.hierarchy[this.offset_from].parent !== current) this.offset_from++;
        this.reposition();
    }
    reposition() {
        if(!this.repr || this.is_hidden) return;
        let {choose, socket} = this.get_offset();
        if(choose !== this.offset_to || this.repr.svg.parentNode !== this.alias.parent.child_div) {
            this.change_to_fit(choose, socket);
        }
        else if(socket !== this.repr.endSocket) this.repr.setOptions({endSocket: socket});
        this.repr.position();
        this.adjust_svg();
    }
    init_mouse_event() {
        let path = this.repr.svg.querySelector('path');
        path.onclick = (e) => {
            e.stopPropagation();
            if(e.ctrlKey) GraphUI.signal(this.release_truncate()); 
        };
        path.oncontextmenu = (e) => { e.preventDefault(); Menu.edge.popup(e, this)};
        path.onmousedown = (e0) => this.change_gravity(e0);
    }
    /**@param {MouseEvent} e0  */
    change_gravity(e0) {
        e0.stopPropagation();
        if(e0.button === 1) return window.MathGraph.current.start_scroll(e0);
        this.reposition();
        let move = null, start = null, end = null;
        let start0 = this.repr.startSocketGravity, end0 = this.repr.endSocketGravity;
        document.addEventListener('mousemove', move = (e) => {
            e.preventDefault();
            if(!start || !end) [start, end] =   [this.alias, this.shadow]
                                                .map(n => n.html_div.getBoundingClientRect())
                                                .map(r => { r.width /= 2; r.height /= 2; return r});
            this.repr.setOptions({
                startSocketGravity: [e.x - start.right, e.y - start.bottom],
                endSocketGravity: [e.x - end.right, e.y - end.bottom],
            });
        })
        document.addEventListener('mouseup', (e) => {
            if(start && end) GraphHistory.register('gravity', {
                from: this.alias, to: this.shadow,
                old_start: start0, old_end: end0,
                start: [e.x - start.right, e.y - start.bottom], end: [e.x - end.right, e.y - end.bottom]
            });
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    change_to_fit(offset, socket) {
        this.remove_from_shadow();
        this.offset_to = offset;
        let next = this.hierarchy[offset];
        let edge = next.display.from.get(this.alias);
        if(!edge) {
            if(!this.repr) {
                this.repr = new LeaderLine(this.alias.html_div, next.html_div, window.MathGraph.edge_opt);
                this.repr.setOptions({dash: this.truncate !== null});
                this.repr.svg = document.body.lastChild;
                this.alias.parent.child_div.appendChild(this.repr.svg);
                this.init_mouse_event();
            }
            next.display.from.set(this.alias, this.repr);
            this.alias.display.to.set(next, this.repr);
            this.alias.parent.child_div.appendChild(this.repr.svg);
            this.repr.setOptions({end: next.html_div, endSocket: socket});
            edge = this.repr;
        }
        if(this.repr !== edge && this.repr) {
            document.body.appendChild(this.repr.svg); 
            this.repr.remove(); 
        }
        this.repr = edge;
        let count = (edge.count = (edge.count ?? 0) + (this.to === next ? 1 : 2));
        edge.setOptions({middleLabel: label_of(count)});
    }
    remove_from_shadow() {
        if(!this.repr) return;
        if(this.repr.count <= 2) {
            this.repr.count = 0;
            let moving = this.alias.is_pseudo && !this.alias.display.to.has(this.shadow);
            (moving ? this.alias.ref : this.alias).display.to.delete(this.shadow);
            this.shadow.display.from.delete(moving ? this.alias.ref: this.alias);
        }
        else {
            let count = this.repr.count -= 2;
            if(this.repr.count < 2) {
                this.repr.setOptions({dash: this.truncate !== null, middleLabel: ''});
            }
            else this.repr.setOptions({middleLabel: label_of(count)});
            this.repr = null;
        }
    }
    get_offset() {
        let cur = this.hierarchy[this.offset_from].html_div;
        let render_h = cur.assoc_node.renderer.offsetHeight;
        let [x0, y0, x1, y1] = [0, 0, cur.offsetWidth, cur.offsetHeight - render_h];
        let [dx, dy] = [0, 0];
        let choose = this.offset_from, socket = 'auto';
        for(let i = this.offset_from - 1; i >= 0; i--) {
            cur = this.hierarchy[i].html_div
            dx += cur.offsetLeft - cur.parentNode.scrollLeft;
            dy += cur.offsetTop - cur.parentNode.scrollTop;
            let dy1 = dy + cur.offsetHeight, dx1 = dx + cur.offsetWidth;
            let test = 0, maybe_socket = 'auto';
            if(dx > x1 || dy > y1 || dy1 < y0 || dx1 < x0) break;
            if(dx > x0) { test++; x0 = dx; } else maybe_socket = 'right';
            if(dy > y0) { test++; y0 = dy; } else maybe_socket = 'bottom'; 
            if(dx1 < x1) { test++; x1 = dx1; } else maybe_socket = 'left'; 
            if(dy1 < y1) { test++; y1 = dy1; } else maybe_socket = 'top';
            dy += this.hierarchy[i + 1].renderer.offsetHeight;
            y0 = Math.max(dy, y0);
            if(test < 3) continue;
            socket = maybe_socket;
            choose = i;
            if(!this.hierarchy[i].is_maximize) break;
        }
        return {choose: choose, socket: socket};
    }
    /**@param {NodeUI} from @param {NodeUI} to @returns {EdgeUI | string} */
    static create(from, to) {
        if(to.is_pseudo) return "can not create edge connect to a pseudo node";
        /** @type {NodeUI}*/
        let actual = from.is_pseudo ? from.ref : from, current = window.MathGraph.current;
        if(NodeUI.lca(actual, to) !== actual.parent) {
            return "can only connect a node to it's sibling's descendant" + (actual !== from ? 
                " (the anchor node is a pseudo node which is not define primarly inside this node)" : "");
        }
        if(actual.type === 'result') return 'can not connect from the conclusion node';
        if(to.type === 'given') return 'can not connect to an input node'
        let index = from.display.to.get(to)?.count;
        if(index && index % 2 == 1) return 'the edge is already connected';
        if(!window.MathGraph.is_parsing && !current.is_ancestor(from)) from = this.create_pseudo(from);
        let edge = new EdgeUI(from, to);
        edge.reposition();
        GraphHistory.register('make_edge', {from: actual, to: to, ref: actual.ref !== null});
        return edge;
    }
    show(effect) {
        if(!this.repr) return;
        this.repr.hide('none');
        this.repr.show(effect);
    }
    hide(effect) {
        this.repr.hide(effect);
    }
    release_truncate() {
        if(!this.repr.dash) return '';
        if(this.repr.count > 1) return 'can not de-truncate overllaped edge';
        if(!window.MathGraph.current.is_ancestor(this.truncate)) {
            return `fail to de-truncate, the truncated node ` +
                    `associated with this edge is not a child of the current focusing node`;
        }
        let old = GraphHistory.active;
        GraphHistory.register('release_truncate', {node: this.truncate});
        GraphHistory.active = true;
        this.truncate.ref = null;
        let to_edge = this.truncate.math.to.get(this.to);
        this.truncate.html_div.style.display = "";
        to_edge.show('draw');
        to_edge.reposition();
        for(const edge of this.truncate.external_ref) if(!edge.alias.is_truncated) {
            this.alias.parent.child_div.appendChild(edge.repr.svg);
            edge.show('draw');
            edge.reposition();
        }
        this.truncate = null;
        this.remove();
        GraphHistory.active = old;
    }
    remove() {
        if(this.truncate !== null) return this.release_truncate();
        let old = GraphHistory.active;
        GraphHistory.register('remove_edge', {from: this.from, to: this.to, ref: this.from.ref !== null});
        GraphHistory.active = true;
        this.remove_from_shadow();
        if(this.repr?.svg) document.body.appendChild(this.repr.svg);
        this.repr?.remove();
        this.from.math.to.delete(this.to);
        this.to.math.from.delete(this.from);
        for(const parent of this.hierarchy) parent.external_ref.delete(this);
        GraphHistory.active = old;
    }
    /**@returns {NodeUI} */
    get shadow() {
        return this.hierarchy[this.offset_to];
    }
    get stored() {
        return this.alias.parent.child_div;
    }
    get to() {
        return this.hierarchy[0];
    }
    get is_hidden() {
        return this.repr.svg.style.visibility === "hidden";
    }
    /**@param {NodeUI} pseudo */
    static reclaim_edges(pseudo) {
        pseudo.html_div.classList.remove('pseudo');
        if(!hints['refer'].some(hint => pseudo.header.textContent.startsWith(hint))) {
            pseudo.html_div.classList.remove('refer')
        }
        pseudo.html_div.assoc_node = pseudo.ref;
        pseudo.ref.parent.child_div.appendChild(pseudo.html_div);
        for(let [node, edge] of pseudo.math.to) {
            node.display.from.delete(pseudo);
            pseudo.ref.parent.child_div.appendChild(edge.repr.svg);
            edge.offset_from = edge.hierarchy.length - 1;
            edge.alias = pseudo.ref;
        }
        window.MathGraph.all_pseudo.delete(pseudo);
        window.MathGraph.not_rendered.add(pseudo.ref);
        pseudo.parent.children.delete(pseudo);
        if(pseudo.ref.ref == pseudo) pseudo.ref.ref = null;
    }
    static create_pseudo(from) {
        let current = window.MathGraph.current;
        let pseudo = new NodeUI(current, from);
        window.MathGraph.all_pseudo.add(pseudo);
        pseudo.html_div.classList.add('refer', 'pseudo');
        current.children.add(pseudo);
        current.child_div.appendChild(pseudo.html_div);
        return pseudo;
    }
}
function label_of(count) {
    return count >= 2 ? LeaderLine.captionLabel('+' + (count >> 1), {
        fontFamily: 'serif',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#2edb76',
        outlineColor: ''
    }) : '';
}
document.addEventListener('DOMContentLoaded', e => {
    Menu.edge = new Menu(document.getElementById('edge'));
    let menu = Menu.edge.items.childNodes;
    menu[HIGHTLIGHT_].onclick = e => {
        let target = Menu.edge.associate.repr, default_color = window.MathGraph.edge_opt.color;
        if(target.color === default_color) target.setOptions({color: '#ff00ff'});
        else target.setOptions({color: default_color});
    }
    menu[TRUNCATE_].onclick = e => GraphUI.signal(Menu.edge.associate.release_truncate());
    menu[REMOVE_].onclick = e => {
        let edge = Menu.edge.associate;
        if(window.MathGraph.readonly) return GraphUI.signal('can not delete edges in readonly mode');
        if(edge.repr.count > 2) return GraphUI.signal('can not remove this edge because this edge is' +
                                        'overlapped among ' + (edge.repr.count >> 1) + ' other edges');
        Menu.edge.associate.remove()
    };

})
const HIGHTLIGHT_ = 0, TRUNCATE_ = 1, REMOVE_ = 2;