class UI {
    static new_edge(start, e) {
        if(!e) return;
        e.stopPropagation();
        start.highlight();
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
            if(end && end != start && !start.to.has(end)) start.connect(end);
            dot.style.display = "none";
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    static edge_option(o) {

    }
    static edge_rescale(e) {

    }
    static make_edge(from, to) {

    }
    static get_name() {

    }
    static refresh_href(node) {
        let href = document.getElementById('href');
        href.innerHTML = '';
        for(let cur = this; cur; cur = cur.parent) {
            href.insertAdjacentHTML('afterbegin', `
                <button class="parent">${map_to_html(cur.summary.id)}</button>
            `);
            href.firstElementChild.onclick = (e) => this.switch_to(cur);
        }
    }
    static switch_to(node) {

    }
    static monitor_node_at_cursor(e) {
        if(!e.ctrlKey) return;
        if(window.MathGraph.readonly) return alert("can create or edit node in readonly mode");

        document.removeEventListener('click', GraphUI.monitor_node_at_cursor);
        let node = is_node_component(e.target);
        if(!node) {
            node = new NodeUI(get_random_name(), GraphUI.current_graph);
            let viewpoint = document.documentElement.getBoundingClientRect();
            node.html_div.style.top = `${e.clientY - viewpoint.top}px`;
            node.html_div.style.left = `${e.clientX - viewpoint.left}px`
        }
        editor.load(node);
    }
}
//setup function
document.addEventListener('DOMContentLoaded', () => {
    window.MathGraph.all_label = new Set();
    document.addEventListener('click', NodeUI.monitor_node_at_cursor);
    document.querySelector('.undo').onclick = () => GraphHistory.undo();
    document.querySelector('.redo').onclick = () => GraphHistory.redo();
});