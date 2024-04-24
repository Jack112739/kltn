class UI {
    static new_edge(start, e) {
        if(!e) return;
        e.stopPropagation();
        let dot = document.getElementById("dot"), move;
        let viewpoint  = document.documentElement.getBoundingClientRect();
        dot.style.left = `${e.clientX - viewpoint.left}px`;
        dot.style.top = `${e.clientY - viewpoint.top }px`;
        dot.style.display = "block";
        let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 3});
        document.addEventListener('mousemove', move =  e => {
            dot.style.left = `${e.clientX - viewpoint.left}px`;
            dot.style.top = `${e.clientY - viewpoint.top }px`;
            line.position();
        });
        document.addEventListener('click', e => {
            let end = is_node_component(e.target);
            line.remove();
            if(end && end != start && !start.to.has(end) && !end.is_maximize) UI.make_edge(start, end);
            dot.style.display = "none";
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    static edge_option(edge, o) {

    }
    static edge_rescale(edge, e) {

    }
    static make_edge(from, to) {

    }
    static remove_edge(from, to) {

    }
    static get_name() {

    }
    static refresh_href(node) {
        let href = document.getElementById('href');
        href.innerHTML = '';
        for(let cur = node; cur.parent; cur = cur.parent) {
            href.insertAdjacentHTML('afterbegin', `
                <button class="parent">${map_to_html(node.id ? node.id : '..')}</button>
            `);
            href.firstElementChild.onclick = (e) => this.switch_to(cur);
        }
    }
    /**@param {NodeUI} node */
    static switch_to(node) {
        let err = node.maximize();
        if(err) return UI.signal(err);
        
    }
    static monitor_node_at_cursor(e) {
        if(!e.ctrlKey) return;
        if(window.MathGraph.readonly) return alert("can create or edit node in readonly mode");

        document.removeEventListener('click', UI.monitor_node_at_cursor);
        let node = is_node_component(e.target);
        if(!node || node.is_maximize) {
            let parent = node ? node : window.MathGraph.current;
            node = new NodeUI(parent);
            let viewpoint = document.documentElement.getBoundingClientRect();
            node.html_div.style.top = `${e.clientY - viewpoint.top}px`;
            node.html_div.style.left = `${e.clientX - viewpoint.left}px`
            parent.child_div.appendChild(node.html_div);
            parent.childs.add(node);
        }
        editor.load(node);
    }
    static signal(str) {
        if(str) alert(str);
    }
}
//setup function
document.addEventListener('DOMContentLoaded', () => {
    window.MathGraph.all_label = new Map();
    window.MathGraph.current = new NodeUI(null);

    document.addEventListener('click', UI.monitor_node_at_cursor);
    document.querySelector('.undo').onclick = () => GraphHistory.undo();
    document.querySelector('.redo').onclick = () => GraphHistory.redo();
});