import React, { useLayoutEffect, useRef } from 'react';
import { t } from '../i18n.js';

/** Applies the active locale to text and accessible labels throughout the rendered game UI. */
export default function LocalizedDom({ language = 'en', children }) {
  const rootRef = useRef(null);
  const textRecords = useRef(new WeakMap());
  const attributeRecords = useRef(new WeakMap());

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const localizeText = (node) => {
      const current = node.nodeValue || '';
      const record = textRecords.current.get(node);
      const original = record && current === record.output ? record.original : current;
      const trimmed = original.trim();
      const normalized = trimmed.replace(/\s+/g, ' ');
      const translated = normalized ? t(normalized, language) : normalized;
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      const output = normalized ? `${leading}${translated}${trailing}` : original;
      if (output !== current) node.nodeValue = output;
      textRecords.current.set(node, { original, output });
    };

    const localizeAttributes = (element) => {
      const names = ['aria-label', 'title', 'placeholder', 'alt'];
      let records = attributeRecords.current.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.current.set(element, records);
      }
      for (const name of names) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name) || '';
        const record = records.get(name);
        const original = record && current === record.output ? record.original : current;
        const output = t(original, language);
        if (output !== current) element.setAttribute(name, output);
        records.set(name, { original, output });
      }
    };

    const localizeTree = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue?.trim()) localizeText(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE && node !== root) return;
      if (node.nodeType === Node.ELEMENT_NODE) localizeAttributes(node);
      for (const child of node.childNodes) localizeTree(child);
    };

    localizeTree(root);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') localizeText(record.target);
        else if (record.type === 'attributes') localizeAttributes(record.target);
        else for (const node of record.addedNodes) localizeTree(node);
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'],
    });
    return () => observer.disconnect();
  }, [language]);

  return <div ref={rootRef} className="kronox-localized-root" style={{ display: 'contents' }}>{children}</div>;
}
