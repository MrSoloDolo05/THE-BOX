/* =========================================================
   EVENTS — Shared event delegation helpers

   Centralises click / change delegation so that dynamically
   generated HTML never needs inline onclick="..." attributes.
   Provides a managed confirm handler for the shared modal.
========================================================= */


/* ---------------------------------------------------------
   Click delegation

   Attaches a single listener to a static container.
   When a click bubbles up, the handler finds the closest
   ancestor matching *selector* that lives inside *container*
   and invokes *callback* with (event, matchedElement).

   handler receives (event, element)
--------------------------------------------------------- */

function delegateClick(container, selector, handler) {

    if (!container) {
        return;
    }

    container.addEventListener(
        "click",
        function (e) {

            const el =
                e.target.closest(selector);


            if (el && container.contains(el)) {

                handler(e, el);
            }
        }
    );
}


/* ---------------------------------------------------------
   Change delegation

   Same pattern as delegateClick but for `change` events
   (used on <input> elements inside dynamically rendered
   sections).  Change events bubble in all modern browsers.
--------------------------------------------------------- */

function delegateChange(container, selector, handler) {

    if (!container) {
        return;
    }

    container.addEventListener(
        "change",
        function (e) {

            const el =
                e.target.closest(selector);


            if (el && container.contains(el)) {

                handler(e, el);
            }
        }
    );
}


/* ---------------------------------------------------------
   Modal confirm handler manager

   The #modal-confirm button is shared across many modals.
   Each modal function calls modalConfirm.set(callback) to
   register its handler; closeModal() calls modalConfirm.clear()
   so handlers are removed without stacking listeners.
--------------------------------------------------------- */

const modalConfirm = {

    _handler: null,

    set(callback) {

        const btn =
            document.getElementById(
                "modal-confirm"
            );

        if (!btn) {
            return;
        }


        if (this._handler) {

            btn.removeEventListener(
                "click",
                this._handler
            );
        }


        this._handler = callback;

        btn.addEventListener(
            "click",
            this._handler
        );
    },

    clear() {

        const btn =
            document.getElementById(
                "modal-confirm"
            );

        if (!btn) {
            return;
        }


        if (this._handler) {

            btn.removeEventListener(
                "click",
                this._handler
            );

            this._handler = null;
        }
    }

};
