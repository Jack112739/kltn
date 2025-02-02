"use strict";

class FileIO {
    /** 
     * @param {NodeUI} node @returns {String} 
    * @param {{ret: string[], map: Map<NodeUI, string>}} context
    */
    static parse_graph_recursive(node, context) {
        let topo = new Map();
        let deg = new Map();
        let queue = [], i = 0, exclude_pseudo = 0;
        for(const child of node.children) if(!child.is_pseudo) deg.set(child, 0);
        for(const child of node.children) {
            if(child.is_pseudo) continue;
            exclude_pseudo++;
            let adj = new Set();
            if(child.type === 'given') queue.push(child);
            for(const [_, edge]of child.math.to) if(!edge.truncate) {
                let relative_to = edge.hierarchy.at(-1);
                if(!adj.has(relative_to)) deg.set(relative_to, deg.get(relative_to) + 1);
                adj.add(relative_to);
            }
            topo.set(child, adj);
        }
        for(const [child, degree] of deg) if(child.type !== 'given' && degree === 0) queue.push(child);
        bfs:
        while(i < queue.length) {
            let cur = queue[i];
            let header = `%% ${(cur.is_truncated ? '#': '') + cur.header.textContent}`
                        + remove_px(cur.html_div, "top", "left")
                        + remove_px(cur.renderer, "height", "width")
                        + remove_px(cur.child_div, "height", "width");
            for(const [ref, edge] of cur.math.from) {
                if(edge.truncate) continue;
                if(ref.id !== '') { header += ', ' + ref.id; continue; }
                let num = context.map.get(ref);
                if(!num) { queue = []; break bfs;}
                header += ', ' + num;
            } 
            context.ret.push(header);
            context.map.set(cur, cur.id !== '' ? cur.id : '#' + context.ret.length);
            if(cur.id) context.ret.push(`\\label{${cur.id}}`);
            context.ret = context.ret.concat(cur.raw_text.split('\n'));
            if(!cur.raw_text.endsWith('\\\\')) context.ret.push('\\\\');
            for(const adj of topo.get(cur)) {
                deg.set(adj, deg.get(adj) - 1);
                if(deg.get(adj) === 0) queue.push(adj);
            }
            if(cur.children.size > 0) {
                context.ret.push('\\begin{proof}');
                let err = this.parse_graph_recursive(cur, context);
                if(err) return err;
                context.ret.push('\\end{proof}');
            }
            i++;
        }
        if(queue.length !== exclude_pseudo) {
            return `Error at node ${
                !node.parent ? `root (${window.MathGraph.workspace})`:
                !node.parent.id ? `with content ${node.parent.raw_text}`:
                                 `with label ${node.parent.id}` 
                }: A graph can not contain cyclic references`;
        }
        return null;
    }
    static parse_graph(root) {
        let context = {
            map: new Map(),
            ret : [`%created on ${(new Date()).toLocaleString()}:`, '', '']
        };
        let err = this.parse_graph_recursive(root, context);
        if(err) return new Error(err);
        return context.ret.join('\n');
    }
    static parse_file(str, file_name) {
        let lines = str.split('\n');
        let cur = null, err_msg = null, now = null;
        let implicit_id = new Map();
        let all_edge = [], all_truncate = [];
        let labels = new Map();
        GraphHistory.active = true;
        window.MathGraph.is_parsing = true;
        cur = new NodeUI(null);
        window.MathGraph.all_label = new Map();
        parse:
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if(line.startsWith('%%')) {
                now = new NodeUI(cur);
                cur.children.add(now);
                implicit_id.set(i, now);
                let headers = line.slice(2).split(',').map(str => str.trim());
                let implicit_start = 7;
                if(headers[0].startsWith('#')) {
                    all_truncate.push(now);
                    headers[0] = headers[0].slice(1);
                }
                let test = now.rename(headers[0]);
                if(test) {
                    err_msg = `error at line ${i+1}: ${test}`;
                    break parse;
                }
                else {
                    labels.set(now.id, now);
                }
                try {
                    now.html_div.style.top = parse_int_px(headers[1], 1);
                    now.html_div.style.left = parse_int_px(headers[2], 2);
                    now.renderer.style.height = parse_int_px(headers[3], 3);
                    now.renderer.style.width = parse_int_px(headers[4], 4);
                    now.child_div.style.height = parse_int_px(headers[5], 5);
                    now.child_div.style.width = parse_int_px(headers[6], 6);
                } catch(e) {
                    implicit_start = e;
                }
                for(let j = implicit_start; j < headers.length; j++) {
                    if(headers[j] === '') continue;
                    if(headers[j].startsWith('#')) test = FileIO.link(now, headers, j, implicit_id);
                    else if(!labels.get(headers[j])) {
                        test = `node named ${headers[j]} does not exist `;
                    }
                    else test = now.reference(labels.get(headers[j]));
                    
                    if(typeof test === 'string') {
                        err_msg = `error at line ${i+1}: ${test}`;
                        break parse;
                    }
                    else all_edge.push(test);
                }
                if(lines[i+1].trim() === `\\label{${now.id}}`) i += 1;
            }
            else if(line === '\\begin{proof}') {
                if(!now) {
                    err_msg = `error at line ${i+1}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text = now.raw_text.trim();
                if(now.raw_text.startsWith('\\begin{lemma}')) {
                    if(!now.raw_text.endsWith('\\end{lemma}')) {
                        err_msg = `error at line ${i+1}: missing \\end{lemma}`;
                        break parse;
                    }
                    now.raw_text = now.raw_text.slice('\\begin{lemma}'.length, -'\\end{lemma}'.length);
                }
                cur = now;
                now = null;
            }
            else if(line === '\\end{proof}') {
                cur = cur.parent;
                now = null;
            }
            else {
                // comments
                if(line.startsWith('%') || line.length === 0) continue 
                if(!now) {
                    err_msg = `error at line ${i+1}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text += '\n';
                now.raw_text += line;
            }
        }
        if(cur.parent && !err_msg) err_msg = `missing \\end{proof} at the end of the document`;
        window.MathGraph.is_parsing = false;
        if(err_msg) return new Error(err_msg);
        FileIO.compile(cur);
        FileIO.render(cur, all_edge, all_truncate);
        GraphUI.finish_initialize(cur, file_name);
        cur.renderer.textContent = file_name;
        GraphHistory.active = false;
        return {root: cur, labels: labels};
    }
    static compile(node) {
        node.raw_text = node.raw_text.trim();
        if(node.raw_text.endsWith('\\\\')) node.raw_text = node.raw_text.slice(0, -2);
        for(const child of node.children) FileIO.compile(child);
        let data = (new Fragment(node.raw_text, 'text')).output('html');
        for(const child of data) node.renderer.appendChild(child);
        node.parent?.child_div.appendChild(node.html_div);
    }
    static link(now, args, id, implicit_id) {
        if(isNaN(args[id].slice(1))) return `invalid syntax, expect the ${id}-th arguement`
                                        + `to be a valid reference or a '#' follow by a number`;
        let line = parseInt(args[id].slice(1));
        let node = implicit_id.get(line - 1);
        if(!node) return `can not reference to node at line ${line}`
                        + `because there are no node's comment (start with %%) at that line`;
        return now.reference(node);

    }
    static render(node, edges, truncate) {
        let old = window.MathGraph.current;
        GraphUI.switch_body(node);
        let maximize_recursive = (node1) => {
            node1.renderer.style.minWidth = Math.max(node1.name_rect.width, 45) + "px";
            node1.toggle_detail(!node1.parent || node1.children.size !== 0, true);
            for(const child of node1.children) maximize_recursive(child);
        }
        maximize_recursive(node, true);
        for(const edge of edges) {
            edge.change_to_fit(edge.offset_to, 'auto');
            edge.reposition();
            edge.show('draw');
        }
        for(const truncate_node of truncate) truncate_node.truncate();
        GraphUI.switch_body(old);
    }
    static file_saver;
}
function parse_int_px(str, i) {
    if(isNaN(str)) throw i;
    return str.trim() + "px";
}
function remove_px(div, dim1, dim2) {
    return `, ${div.style[dim1].slice(0, -2)}, ${div.style[dim2].slice(0, -2)}`;
}