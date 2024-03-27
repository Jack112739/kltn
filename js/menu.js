
class SuggestMenu {

    static auto_complete(e) {
        const symbol = {'$':'$', '(':')', '[':']', '{':'}', '\\(':'\\)', '\\[':'\\]'};
        let lookup = symbol;
        let selection = window.getSelection();
        switch(e.key) {
        case '>':
            lookup = tags;
            //fallthrough
        case '$':
        case '(':
        case '[':
        case '{':
            e.preventDefault();
            if(!selection.isCollapsed) {
                document.execCommand()
            }
            break;
        case '\\':
            node.addEventListener('keydown', SuggestMenu.open_suggestor); 
            break;
        default:
            break;
        }
    }
}