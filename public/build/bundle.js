
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.45.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Button.svelte generated by Svelte v3.45.0 */

    const file$6 = "src\\components\\Button.svelte";

    function create_fragment$6(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr_dev(button, "class", "svelte-1pebrsp");
    			add_location(button, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\components\Clock.svelte generated by Svelte v3.45.0 */

    const file$5 = "src\\components\\Clock.svelte";

    function create_fragment$5(ctx) {
    	let nav;
    	let a;
    	let t1;
    	let p;
    	let t3;
    	let h1;
    	let t4;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "⬅️";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Clock";
    			t3 = space();
    			h1 = element("h1");
    			t4 = text(/*clock*/ ctx[0]);
    			attr_dev(a, "href", "index.html");
    			add_location(a, file$5, 8, 2, 176);
    			attr_dev(p, "class", "svelte-scukl8");
    			add_location(p, file$5, 9, 2, 207);
    			attr_dev(nav, "class", "svelte-scukl8");
    			add_location(nav, file$5, 7, 0, 167);
    			attr_dev(h1, "class", "svelte-scukl8");
    			add_location(h1, file$5, 11, 0, 229);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    			append_dev(nav, t1);
    			append_dev(nav, p);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*clock*/ 1) set_data_dev(t4, /*clock*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Clock', slots, []);
    	let clock = new Date().toLocaleTimeString("sv-SE");

    	setInterval(
    		() => {
    			$$invalidate(0, clock = new Date().toLocaleTimeString("sv-SE"));
    		},
    		1000
    	);

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Clock> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ clock });

    	$$self.$inject_state = $$props => {
    		if ('clock' in $$props) $$invalidate(0, clock = $$props.clock);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [clock];
    }

    class Clock extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Clock",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Tabata.svelte generated by Svelte v3.45.0 */

    const { console: console_1 } = globals;
    const file$4 = "src\\components\\Tabata.svelte";

    // (114:2) {#if currentState != state.idle}
    function create_if_block_2$1(ctx) {
    	let p0;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let p1;
    	let t5;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("Round ");
    			t1 = text(/*currentRound*/ ctx[4]);
    			t2 = text("/");
    			t3 = text(/*rounds*/ ctx[2]);
    			t4 = space();
    			p1 = element("p");
    			t5 = text(/*currentState*/ ctx[5]);
    			attr_dev(p0, "class", "info svelte-z99739");
    			add_location(p0, file$4, 114, 4, 2479);
    			attr_dev(p1, "class", "info svelte-z99739");
    			set_style(p1, "color", /*stateColor*/ ctx[6]);
    			add_location(p1, file$4, 116, 4, 2536);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, t1);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentRound*/ 16) set_data_dev(t1, /*currentRound*/ ctx[4]);
    			if (dirty & /*rounds*/ 4) set_data_dev(t3, /*rounds*/ ctx[2]);
    			if (dirty & /*currentState*/ 32) set_data_dev(t5, /*currentState*/ ctx[5]);

    			if (dirty & /*stateColor*/ 64) {
    				set_style(p1, "color", /*stateColor*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(p1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(114:2) {#if currentState != state.idle}",
    		ctx
    	});

    	return block;
    }

    // (120:2) {#if currentState === state.idle}
    function create_if_block_1$1(ctx) {
    	let div7;
    	let form;
    	let div1;
    	let label0;
    	let span0;
    	let t1;
    	let div0;
    	let input0;
    	let t2;
    	let span1;
    	let t4;
    	let div3;
    	let label1;
    	let span2;
    	let t6;
    	let div2;
    	let input1;
    	let t7;
    	let span3;
    	let t9;
    	let div5;
    	let label2;
    	let span4;
    	let t11;
    	let div4;
    	let input2;
    	let t12;
    	let span5;
    	let t14;
    	let div6;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	button = new Button({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			span0 = element("span");
    			span0.textContent = "for";
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			span1 = element("span");
    			span1.textContent = "rounds";
    			t4 = space();
    			div3 = element("div");
    			label1 = element("label");
    			span2 = element("span");
    			span2.textContent = "work";
    			t6 = space();
    			div2 = element("div");
    			input1 = element("input");
    			t7 = space();
    			span3 = element("span");
    			span3.textContent = "seconds";
    			t9 = space();
    			div5 = element("div");
    			label2 = element("label");
    			span4 = element("span");
    			span4.textContent = "rest";
    			t11 = space();
    			div4 = element("div");
    			input2 = element("input");
    			t12 = space();
    			span5 = element("span");
    			span5.textContent = "seconds";
    			t14 = space();
    			div6 = element("div");
    			create_component(button.$$.fragment);
    			attr_dev(span0, "class", "span-left svelte-z99739");
    			add_location(span0, file$4, 124, 12, 2786);
    			attr_dev(input0, "name", "rounds");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "min", "1");
    			attr_dev(input0, "id", "rounds");
    			attr_dev(input0, "class", "svelte-z99739");
    			add_location(input0, file$4, 126, 14, 2873);
    			attr_dev(div0, "class", "input-div");
    			add_location(div0, file$4, 125, 12, 2834);
    			attr_dev(span1, "class", "span-right svelte-z99739");
    			add_location(span1, file$4, 128, 12, 2984);
    			attr_dev(label0, "for", "rounds");
    			attr_dev(label0, "class", "svelte-z99739");
    			add_location(label0, file$4, 123, 10, 2752);
    			attr_dev(div1, "class", "input-1 svelte-z99739");
    			add_location(div1, file$4, 122, 8, 2719);
    			attr_dev(span2, "class", "span-left svelte-z99739");
    			add_location(span2, file$4, 135, 13, 3220);
    			attr_dev(input1, "name", "work");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "min", "1");
    			attr_dev(input1, "id", "work");
    			attr_dev(input1, "class", "svelte-z99739");
    			add_location(input1, file$4, 137, 14, 3308);
    			attr_dev(div2, "class", "input-div");
    			add_location(div2, file$4, 136, 12, 3269);
    			attr_dev(span3, "class", "span-right svelte-z99739");
    			add_location(span3, file$4, 139, 12, 3421);
    			attr_dev(label1, "for", "work");
    			attr_dev(label1, "class", "svelte-z99739");
    			add_location(label1, file$4, 134, 10, 3188);
    			attr_dev(div3, "class", "input-2 svelte-z99739");
    			add_location(div3, file$4, 133, 8, 3155);
    			attr_dev(span4, "class", "span-left svelte-z99739");
    			add_location(span4, file$4, 146, 12, 3664);
    			attr_dev(input2, "name", "rest");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "min", "1");
    			attr_dev(input2, "id", "rest");
    			attr_dev(input2, "class", "svelte-z99739");
    			add_location(input2, file$4, 148, 14, 3752);
    			attr_dev(div4, "class", "input-div");
    			add_location(div4, file$4, 147, 12, 3713);
    			attr_dev(span5, "class", "span-right svelte-z99739");
    			add_location(span5, file$4, 150, 12, 3865);
    			attr_dev(label2, "for", "rest");
    			attr_dev(label2, "class", "svelte-z99739");
    			add_location(label2, file$4, 145, 10, 3632);
    			attr_dev(div5, "class", "input-3 svelte-z99739");
    			add_location(div5, file$4, 144, 8, 3599);
    			attr_dev(div6, "class", "input-4 svelte-z99739");
    			add_location(div6, file$4, 156, 8, 4098);
    			attr_dev(form, "class", "svelte-z99739");
    			add_location(form, file$4, 121, 6, 2666);
    			add_location(div7, file$4, 120, 4, 2653);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(label0, span0);
    			append_dev(label0, t1);
    			append_dev(label0, div0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*rounds*/ ctx[2]);
    			append_dev(label0, t2);
    			append_dev(label0, span1);
    			append_dev(form, t4);
    			append_dev(form, div3);
    			append_dev(div3, label1);
    			append_dev(label1, span2);
    			append_dev(label1, t6);
    			append_dev(label1, div2);
    			append_dev(div2, input1);
    			set_input_value(input1, /*workDuration*/ ctx[0]);
    			append_dev(label1, t7);
    			append_dev(label1, span3);
    			append_dev(form, t9);
    			append_dev(form, div5);
    			append_dev(div5, label2);
    			append_dev(label2, span4);
    			append_dev(label2, t11);
    			append_dev(label2, div4);
    			append_dev(div4, input2);
    			set_input_value(input2, /*restDuration*/ ctx[1]);
    			append_dev(label2, t12);
    			append_dev(label2, span5);
    			append_dev(form, t14);
    			append_dev(form, div6);
    			mount_component(button, div6, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[11]),
    					listen_dev(form, "submit", prevent_default(/*tMinusTen*/ ctx[8]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rounds*/ 4 && to_number(input0.value) !== /*rounds*/ ctx[2]) {
    				set_input_value(input0, /*rounds*/ ctx[2]);
    			}

    			if (dirty & /*workDuration*/ 1 && to_number(input1.value) !== /*workDuration*/ ctx[0]) {
    				set_input_value(input1, /*workDuration*/ ctx[0]);
    			}

    			if (dirty & /*restDuration*/ 2 && to_number(input2.value) !== /*restDuration*/ ctx[1]) {
    				set_input_value(input2, /*restDuration*/ ctx[1]);
    			}

    			const button_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			destroy_component(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(120:2) {#if currentState === state.idle}",
    		ctx
    	});

    	return block;
    }

    // (158:10) <Button>
    function create_default_slot$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("start");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(158:10) <Button>",
    		ctx
    	});

    	return block;
    }

    // (163:2) {#if currentState != state.idle}
    function create_if_block$1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*timer*/ ctx[3]);
    			attr_dev(p, "class", "timer svelte-z99739");
    			add_location(p, file$4, 163, 4, 4247);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*timer*/ 8) set_data_dev(t, /*timer*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(163:2) {#if currentState != state.idle}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let nav;
    	let a;
    	let t1;
    	let p;
    	let t3;
    	let div;
    	let t4;
    	let t5;
    	let current;
    	let if_block0 = /*currentState*/ ctx[5] != /*state*/ ctx[7].idle && create_if_block_2$1(ctx);
    	let if_block1 = /*currentState*/ ctx[5] === /*state*/ ctx[7].idle && create_if_block_1$1(ctx);
    	let if_block2 = /*currentState*/ ctx[5] != /*state*/ ctx[7].idle && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "⬅️";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Tabata";
    			t3 = space();
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(a, "href", "index.html");
    			add_location(a, file$4, 109, 2, 2360);
    			attr_dev(p, "class", "svelte-z99739");
    			add_location(p, file$4, 110, 2, 2391);
    			attr_dev(nav, "class", "svelte-z99739");
    			add_location(nav, file$4, 108, 0, 2351);
    			attr_dev(div, "class", "container svelte-z99739");
    			add_location(div, file$4, 112, 0, 2414);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    			append_dev(nav, t1);
    			append_dev(nav, p);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t4);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t5);
    			if (if_block2) if_block2.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*currentState*/ ctx[5] != /*state*/ ctx[7].idle) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					if_block0.m(div, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*currentState*/ ctx[5] === /*state*/ ctx[7].idle) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*currentState*/ 32) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t5);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*currentState*/ ctx[5] != /*state*/ ctx[7].idle) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function convertMS$1(value) {
    	const sec = value;
    	let minutes = Math.floor(sec / 60);
    	let seconds = sec - minutes * 60;

    	if (minutes < 10) {
    		minutes = "0" + minutes;
    	}

    	if (seconds < 10) {
    		seconds = "0" + seconds;
    	}

    	return minutes + ":" + seconds;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tabata', slots, []);
    	let workDuration = 20;
    	let restDuration = 10;
    	let rounds = 5;
    	let timer = "";
    	let timerTime;
    	let interval;
    	let currentRound = 0;
    	let audio;

    	const state = {
    		idle: "idle",
    		work: "work",
    		rest: "rest",
    		done: "done",
    		countdown: "starting in 10s"
    	};

    	let currentState = state.idle;
    	let stateColor;

    	onMount(() => {
    		audio = document.createElement("audio");
    		audio.src = "/sound/countdown.wav";
    	});

    	function startTimer() {
    		setState(state.work, "green");
    		$$invalidate(4, currentRound += 1);
    		timerTime = workDuration;
    		$$invalidate(3, timer = convertMS$1(timerTime));

    		interval = setInterval(
    			() => {
    				$$invalidate(3, timer = convertMS$1(timerTime - 1));

    				if (timerTime === 0) {
    					if (currentRound === rounds) {
    						setState(state.done);
    						$$invalidate(3, timer = "00:00");
    						console.log("done");
    					} else {
    						startRest(restDuration);
    					}
    				}

    				timerTime -= 1;
    			},
    			1000
    		);

    		console.log("start timer" + " round " + currentRound);
    	}

    	function startRest(restTime) {
    		setState(state.rest, "red");
    		timerTime = restTime;
    		$$invalidate(3, timer = convertMS$1(timerTime));

    		interval = setInterval(
    			() => {
    				$$invalidate(3, timer = convertMS$1(timerTime - 1));

    				if (timerTime === 0) {
    					timerTime = workDuration;
    					startTimer();
    				}

    				timerTime -= 1;
    			},
    			1000
    		);

    		console.log("start rest");
    	}

    	function tMinusTen() {
    		setState(state.countdown, "yellow");
    		timerTime = 10;
    		$$invalidate(3, timer = convertMS$1(timerTime));

    		interval = setInterval(
    			() => {
    				$$invalidate(3, timer = convertMS$1(timerTime - 1));
    				timerTime -= 1;

    				if (timerTime === 4) {
    					audio.play();
    				}

    				if (timerTime === 0) {
    					startTimer();
    				}
    			},
    			1000
    		);
    	}

    	function setState(newState, color) {
    		clearInterval(interval);
    		$$invalidate(5, currentState = newState);
    		$$invalidate(6, stateColor = color);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Tabata> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		rounds = to_number(this.value);
    		$$invalidate(2, rounds);
    	}

    	function input1_input_handler() {
    		workDuration = to_number(this.value);
    		$$invalidate(0, workDuration);
    	}

    	function input2_input_handler() {
    		restDuration = to_number(this.value);
    		$$invalidate(1, restDuration);
    	}

    	$$self.$capture_state = () => ({
    		Button,
    		onMount,
    		workDuration,
    		restDuration,
    		rounds,
    		timer,
    		timerTime,
    		interval,
    		currentRound,
    		audio,
    		state,
    		currentState,
    		stateColor,
    		startTimer,
    		startRest,
    		tMinusTen,
    		setState,
    		convertMS: convertMS$1
    	});

    	$$self.$inject_state = $$props => {
    		if ('workDuration' in $$props) $$invalidate(0, workDuration = $$props.workDuration);
    		if ('restDuration' in $$props) $$invalidate(1, restDuration = $$props.restDuration);
    		if ('rounds' in $$props) $$invalidate(2, rounds = $$props.rounds);
    		if ('timer' in $$props) $$invalidate(3, timer = $$props.timer);
    		if ('timerTime' in $$props) timerTime = $$props.timerTime;
    		if ('interval' in $$props) interval = $$props.interval;
    		if ('currentRound' in $$props) $$invalidate(4, currentRound = $$props.currentRound);
    		if ('audio' in $$props) audio = $$props.audio;
    		if ('currentState' in $$props) $$invalidate(5, currentState = $$props.currentState);
    		if ('stateColor' in $$props) $$invalidate(6, stateColor = $$props.stateColor);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		workDuration,
    		restDuration,
    		rounds,
    		timer,
    		currentRound,
    		currentState,
    		stateColor,
    		state,
    		tMinusTen,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Tabata extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tabata",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\ForTime.svelte generated by Svelte v3.45.0 */

    const file$3 = "src\\components\\ForTime.svelte";

    function create_fragment$3(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "for time";
    			attr_dev(h1, "class", "svelte-1cxhk4e");
    			add_location(h1, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ForTime', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ForTime> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class ForTime extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ForTime",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\components\Emom.svelte generated by Svelte v3.45.0 */

    const file$2 = "src\\components\\Emom.svelte";

    function create_fragment$2(ctx) {
    	let nav;
    	let a;
    	let t1;
    	let p;
    	let t3;
    	let h1;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "⬅️";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Emom";
    			t3 = space();
    			h1 = element("h1");
    			h1.textContent = "emom";
    			attr_dev(a, "href", "index.html");
    			add_location(a, file$2, 1, 2, 9);
    			attr_dev(p, "class", "svelte-1x1klpr");
    			add_location(p, file$2, 2, 2, 40);
    			attr_dev(nav, "class", "svelte-1x1klpr");
    			add_location(nav, file$2, 0, 0, 0);
    			attr_dev(h1, "class", "svelte-1x1klpr");
    			add_location(h1, file$2, 4, 0, 61);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    			append_dev(nav, t1);
    			append_dev(nav, p);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Emom', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Emom> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Emom extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Emom",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\components\Amrap.svelte generated by Svelte v3.45.0 */
    const file$1 = "src\\components\\Amrap.svelte";

    // (54:4) <Button type="submit">
    function create_default_slot$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("start");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(54:4) <Button type=\\\"submit\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let nav;
    	let a;
    	let t1;
    	let p;
    	let t3;
    	let div;
    	let form;
    	let label;
    	let t4;
    	let input0;
    	let t5;
    	let t6;
    	let input1;
    	let t7;
    	let button;
    	let t8;
    	let h1;
    	let t9;
    	let current;
    	let mounted;
    	let dispose;

    	button = new Button({
    			props: {
    				type: "submit",
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "⬅️";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Amrap";
    			t3 = space();
    			div = element("div");
    			form = element("form");
    			label = element("label");
    			t4 = text("for ");
    			input0 = element("input");
    			t5 = text(" min");
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			create_component(button.$$.fragment);
    			t8 = space();
    			h1 = element("h1");
    			t9 = text(/*timer*/ ctx[1]);
    			attr_dev(a, "href", "index.html");
    			add_location(a, file$1, 45, 2, 1034);
    			attr_dev(p, "class", "svelte-je9x79");
    			add_location(p, file$1, 46, 2, 1065);
    			attr_dev(nav, "class", "svelte-je9x79");
    			add_location(nav, file$1, 44, 0, 1025);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "min", "1");
    			attr_dev(input0, "class", "svelte-je9x79");
    			add_location(input0, file$1, 50, 22, 1184);
    			attr_dev(label, "for", "");
    			attr_dev(label, "class", "svelte-je9x79");
    			add_location(label, file$1, 50, 4, 1166);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "1");
    			attr_dev(input1, "class", "range svelte-je9x79");
    			add_location(input1, file$1, 51, 4, 1259);
    			attr_dev(form, "class", "svelte-je9x79");
    			add_location(form, file$1, 49, 2, 1114);
    			attr_dev(h1, "class", "svelte-je9x79");
    			add_location(h1, file$1, 55, 2, 1388);
    			attr_dev(div, "class", "container svelte-je9x79");
    			add_location(div, file$1, 48, 0, 1087);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    			append_dev(nav, t1);
    			append_dev(nav, p);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, form);
    			append_dev(form, label);
    			append_dev(label, t4);
    			append_dev(label, input0);
    			set_input_value(input0, /*inputMinutes*/ ctx[0]);
    			append_dev(label, t5);
    			append_dev(form, t6);
    			append_dev(form, input1);
    			set_input_value(input1, /*inputMinutes*/ ctx[0]);
    			append_dev(form, t7);
    			mount_component(button, form, null);
    			append_dev(div, t8);
    			append_dev(div, h1);
    			append_dev(h1, t9);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[3]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[4]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[2]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputMinutes*/ 1 && to_number(input0.value) !== /*inputMinutes*/ ctx[0]) {
    				set_input_value(input0, /*inputMinutes*/ ctx[0]);
    			}

    			if (dirty & /*inputMinutes*/ 1) {
    				set_input_value(input1, /*inputMinutes*/ ctx[0]);
    			}

    			const button_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    			if (!current || dirty & /*timer*/ 2) set_data_dev(t9, /*timer*/ ctx[1]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			destroy_component(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function convertMS(value) {
    	const sec = value;
    	let minutes = Math.floor(sec / 60);
    	let seconds = sec - minutes * 60;

    	if (minutes < 10) {
    		minutes = "0" + minutes;
    	}

    	if (seconds < 10) {
    		seconds = "0" + seconds;
    	}

    	return minutes + ":" + seconds;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Amrap', slots, []);
    	let inputMinutes = 1;
    	let timer = "";
    	let tMinusAmrap;

    	const handleSubmit = () => {
    		let tMinus = 10;
    		$$invalidate(1, timer = convertMS(tMinus));

    		let startCDId = setInterval(
    			() => {
    				$$invalidate(1, timer = convertMS(tMinus - 1));
    				tMinus--;

    				if (tMinus === 0) {
    					clearInterval(startCDId);
    					tMinusAmrap = inputMinutes * 60;
    					$$invalidate(1, timer = convertMS(tMinusAmrap));

    					let amrapCDId = setInterval(
    						() => {
    							$$invalidate(1, timer = convertMS(tMinusAmrap - 1));
    							tMinusAmrap--;

    							if (tMinusAmrap === 0) {
    								clearInterval(amrapCDId);
    							}
    						},
    						1000
    					);
    				}
    			},
    			1000
    		);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Amrap> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		inputMinutes = to_number(this.value);
    		$$invalidate(0, inputMinutes);
    	}

    	function input1_change_input_handler() {
    		inputMinutes = to_number(this.value);
    		$$invalidate(0, inputMinutes);
    	}

    	$$self.$capture_state = () => ({
    		Button,
    		inputMinutes,
    		timer,
    		tMinusAmrap,
    		convertMS,
    		handleSubmit
    	});

    	$$self.$inject_state = $$props => {
    		if ('inputMinutes' in $$props) $$invalidate(0, inputMinutes = $$props.inputMinutes);
    		if ('timer' in $$props) $$invalidate(1, timer = $$props.timer);
    		if ('tMinusAmrap' in $$props) tMinusAmrap = $$props.tMinusAmrap;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		inputMinutes,
    		timer,
    		handleSubmit,
    		input0_input_handler,
    		input1_change_input_handler
    	];
    }

    class Amrap extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Amrap",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.45.0 */
    const file = "src\\App.svelte";

    // (21:6) {#if showButtons}
    function create_if_block_5(ctx) {
    	let button0;
    	let t0;
    	let button1;
    	let t1;
    	let button2;
    	let t2;
    	let button3;
    	let t3;
    	let button4;
    	let current;

    	button0 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button0.$on("click", /*click_handler*/ ctx[6]);

    	button1 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1.$on("click", /*click_handler_1*/ ctx[7]);

    	button2 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button2.$on("click", /*click_handler_2*/ ctx[8]);

    	button3 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button3.$on("click", /*click_handler_3*/ ctx[9]);

    	button4 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button4.$on("click", /*click_handler_4*/ ctx[10]);

    	const block = {
    		c: function create() {
    			create_component(button0.$$.fragment);
    			t0 = space();
    			create_component(button1.$$.fragment);
    			t1 = space();
    			create_component(button2.$$.fragment);
    			t2 = space();
    			create_component(button3.$$.fragment);
    			t3 = space();
    			create_component(button4.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(button1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(button2, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(button3, target, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(button4, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    			const button3_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button3_changes.$$scope = { dirty, ctx };
    			}

    			button3.$set(button3_changes);
    			const button4_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button4_changes.$$scope = { dirty, ctx };
    			}

    			button4.$set(button4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			transition_in(button3.$$.fragment, local);
    			transition_in(button4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			transition_out(button3.$$.fragment, local);
    			transition_out(button4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(button1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(button2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(button3, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(button4, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(21:6) {#if showButtons}",
    		ctx
    	});

    	return block;
    }

    // (22:8) <Button on:click={() => ((showClock = true), (showButtons = false))}>
    function create_default_slot_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("clock");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(22:8) <Button on:click={() => ((showClock = true), (showButtons = false))}>",
    		ctx
    	});

    	return block;
    }

    // (23:8) <Button on:click={() => ((showTabata = true), (showButtons = false))}>
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("tabata");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(23:8) <Button on:click={() => ((showTabata = true), (showButtons = false))}>",
    		ctx
    	});

    	return block;
    }

    // (24:8) <Button on:click={() => ((showForTime = true), (showButtons = false))}>
    function create_default_slot_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("for time");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(24:8) <Button on:click={() => ((showForTime = true), (showButtons = false))}>",
    		ctx
    	});

    	return block;
    }

    // (25:8) <Button on:click={() => ((showEmom = true), (showButtons = false))}>
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("emom");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(25:8) <Button on:click={() => ((showEmom = true), (showButtons = false))}>",
    		ctx
    	});

    	return block;
    }

    // (26:8) <Button on:click={() => ((showAmrap = true), (showButtons = false))}>
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("amrap");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(26:8) <Button on:click={() => ((showAmrap = true), (showButtons = false))}>",
    		ctx
    	});

    	return block;
    }

    // (29:6) {#if showClock}
    function create_if_block_4(ctx) {
    	let clock;
    	let current;
    	clock = new Clock({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(clock.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(clock, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(clock.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(clock.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(clock, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(29:6) {#if showClock}",
    		ctx
    	});

    	return block;
    }

    // (32:6) {#if showTabata}
    function create_if_block_3(ctx) {
    	let tabata;
    	let current;
    	tabata = new Tabata({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(tabata.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tabata, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabata.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabata.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tabata, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(32:6) {#if showTabata}",
    		ctx
    	});

    	return block;
    }

    // (35:6) {#if showForTime}
    function create_if_block_2(ctx) {
    	let fortime;
    	let current;
    	fortime = new ForTime({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(fortime.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fortime, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fortime.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fortime.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fortime, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(35:6) {#if showForTime}",
    		ctx
    	});

    	return block;
    }

    // (38:6) {#if showEmom}
    function create_if_block_1(ctx) {
    	let emom;
    	let current;
    	emom = new Emom({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(emom.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(emom, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(emom.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(emom.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(emom, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(38:6) {#if showEmom}",
    		ctx
    	});

    	return block;
    }

    // (41:6) {#if showAmrap}
    function create_if_block(ctx) {
    	let amrap;
    	let current;
    	amrap = new Amrap({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(amrap.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(amrap, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(amrap.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(amrap.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(amrap, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(41:6) {#if showAmrap}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let p;
    	let current;
    	let if_block0 = /*showButtons*/ ctx[0] && create_if_block_5(ctx);
    	let if_block1 = /*showClock*/ ctx[1] && create_if_block_4(ctx);
    	let if_block2 = /*showTabata*/ ctx[2] && create_if_block_3(ctx);
    	let if_block3 = /*showForTime*/ ctx[3] && create_if_block_2(ctx);
    	let if_block4 = /*showEmom*/ ctx[4] && create_if_block_1(ctx);
    	let if_block5 = /*showAmrap*/ ctx[5] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			t4 = space();
    			if (if_block5) if_block5.c();
    			t5 = space();
    			p = element("p");
    			p.textContent = "made by: johan yderhag";
    			attr_dev(div0, "class", "items svelte-kftfv3");
    			add_location(div0, file, 19, 4, 512);
    			attr_dev(div1, "class", "container svelte-kftfv3");
    			add_location(div1, file, 18, 2, 484);
    			attr_dev(p, "class", "svelte-kftfv3");
    			add_location(p, file, 45, 2, 1320);
    			add_location(main, file, 17, 0, 475);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div0, t0);
    			if (if_block1) if_block1.m(div0, null);
    			append_dev(div0, t1);
    			if (if_block2) if_block2.m(div0, null);
    			append_dev(div0, t2);
    			if (if_block3) if_block3.m(div0, null);
    			append_dev(div0, t3);
    			if (if_block4) if_block4.m(div0, null);
    			append_dev(div0, t4);
    			if (if_block5) if_block5.m(div0, null);
    			append_dev(main, t5);
    			append_dev(main, p);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showButtons*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*showButtons*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div0, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*showClock*/ ctx[1]) {
    				if (if_block1) {
    					if (dirty & /*showClock*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_4(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div0, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*showTabata*/ ctx[2]) {
    				if (if_block2) {
    					if (dirty & /*showTabata*/ 4) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_3(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div0, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*showForTime*/ ctx[3]) {
    				if (if_block3) {
    					if (dirty & /*showForTime*/ 8) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_2(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div0, t3);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (/*showEmom*/ ctx[4]) {
    				if (if_block4) {
    					if (dirty & /*showEmom*/ 16) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block_1(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(div0, t4);
    				}
    			} else if (if_block4) {
    				group_outros();

    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});

    				check_outros();
    			}

    			if (/*showAmrap*/ ctx[5]) {
    				if (if_block5) {
    					if (dirty & /*showAmrap*/ 32) {
    						transition_in(if_block5, 1);
    					}
    				} else {
    					if_block5 = create_if_block(ctx);
    					if_block5.c();
    					transition_in(if_block5, 1);
    					if_block5.m(div0, null);
    				}
    			} else if (if_block5) {
    				group_outros();

    				transition_out(if_block5, 1, 1, () => {
    					if_block5 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			transition_in(if_block5);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			transition_out(if_block5);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let showButtons = true;
    	let showClock = false;
    	let showTabata = false;
    	let showForTime = false;
    	let showEmom = false;
    	let showAmrap = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => ($$invalidate(1, showClock = true), $$invalidate(0, showButtons = false));
    	const click_handler_1 = () => ($$invalidate(2, showTabata = true), $$invalidate(0, showButtons = false));
    	const click_handler_2 = () => ($$invalidate(3, showForTime = true), $$invalidate(0, showButtons = false));
    	const click_handler_3 = () => ($$invalidate(4, showEmom = true), $$invalidate(0, showButtons = false));
    	const click_handler_4 = () => ($$invalidate(5, showAmrap = true), $$invalidate(0, showButtons = false));

    	$$self.$capture_state = () => ({
    		Button,
    		Clock,
    		Tabata,
    		ForTime,
    		Emom,
    		Amrap,
    		showButtons,
    		showClock,
    		showTabata,
    		showForTime,
    		showEmom,
    		showAmrap
    	});

    	$$self.$inject_state = $$props => {
    		if ('showButtons' in $$props) $$invalidate(0, showButtons = $$props.showButtons);
    		if ('showClock' in $$props) $$invalidate(1, showClock = $$props.showClock);
    		if ('showTabata' in $$props) $$invalidate(2, showTabata = $$props.showTabata);
    		if ('showForTime' in $$props) $$invalidate(3, showForTime = $$props.showForTime);
    		if ('showEmom' in $$props) $$invalidate(4, showEmom = $$props.showEmom);
    		if ('showAmrap' in $$props) $$invalidate(5, showAmrap = $$props.showAmrap);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showButtons,
    		showClock,
    		showTabata,
    		showForTime,
    		showEmom,
    		showAmrap,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
