export function synchronizeFormState(source: Element, clone: Element): void {
    const sources = [source, ...source.querySelectorAll("input,textarea,select")];
    const clones = [clone, ...clone.querySelectorAll("input,textarea,select")];
    sources.forEach((node, index) => {
        const target = clones[index];
        if (node instanceof HTMLInputElement && target instanceof HTMLInputElement) {
            target.value = node.value;
            target.setAttribute("value", node.value);
            target.checked = node.checked;
            node.checked ? target.setAttribute("checked", "") : target.removeAttribute("checked");
        } else if (node instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
            target.value = node.value;
            target.textContent = node.value;
        } else if (node instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
            target.value = node.value;
            Array.from(target.options).forEach((option, optionIndex) => {
                option.selected = node.options[optionIndex]?.selected ?? false;
                option.selected ? option.setAttribute("selected", "") : option.removeAttribute("selected");
            });
        }
    });
}
