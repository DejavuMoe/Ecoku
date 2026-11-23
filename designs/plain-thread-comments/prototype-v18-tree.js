/* Revision 18 · tree reply connectors.
   The v13 renderer writes each root thread as a flat, pre-ordered list. Production
   nests every reply inside its parent's `.ecoku-children` group, and the v18
   connectors depend on that (`:last-child` decides whether the trunk continues).
   After each render this script moves the existing nodes into the same nested shape,
   keeping their event listeners, so the prototype exercises the production DOM. */
(() => {
  const list = document.getElementById("thread-list");
  if (!list) return;

  const nest = () => {
    // Moving a node drops its focus; v13 refocuses the fold toggle right after render.
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    list.querySelectorAll(".root-thread").forEach((group) => {
      const nodes = Array.from(group.querySelectorAll(":scope > .comment-node"));
      const byId = new Map(nodes.map((node) => [node.dataset.commentId, node]));
      nodes.forEach((node) => {
        const parent = byId.get(node.dataset.parentId);
        if (!parent) return;
        let children = parent.querySelector(":scope > .children");
        if (!children) {
          children = document.createElement("div");
          children.className = "children";
          children.setAttribute("role", "group");
          parent.appendChild(children);
        }
        // Pre-order input keeps siblings in their rendered order.
        children.appendChild(node);
      });
    });
    if (focused && document.activeElement !== focused && focused.isConnected) focused.focus({ preventScroll: true });
  };

  // render() replaces the list's children; nesting only moves nodes deeper, so
  // observing direct children never re-triggers itself.
  new MutationObserver(nest).observe(list, { childList: true });
  nest();
})();
