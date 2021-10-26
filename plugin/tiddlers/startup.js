/*\
title: $:/plugins/EvidentlyCube/GoToShortcut/startup.js
type: application/javascript
module-type: startup
\*/
(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";

    // Export name and synchronous status
    exports.name = "evidentlycube-gotomodal";
    exports.platforms = ["browser"];
    exports.synchronous = true;

    var totalResults = 7;

    var TIDDLER_SHORTCUT = '$:/config/shortcuts/evidently-cube/go-to-modal';

    exports.startup = function () {
        document.addEventListener('keydown', onKeyDown, true);
        listenToIframes();

        var isModalDisplayed = false;
        var $modal = createModal();
        var lastResults = [];
        var selectedIndex = 1;

        function listenToIframes() {
            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    Array.from(mutation.addedNodes)
                        .filter(function (node) {
                            return node.nodeName == 'IFRAME';
                        })
                        .forEach(function (node) {
                            node.addEventListener('load', function (e) {
                                node.contentDocument.addEventListener('keydown', onKeyDown, true);
                            });
                        });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        /**
         * @param {KeyboardEvent} event
         */
        function onKeyDown(event) {
            var shortcutData = $tw.wiki.getTiddler(TIDDLER_SHORTCUT).fields.text;
            var keyInfoArray = $tw.keyboardManager.parseKeyDescriptors(shortcutData,{
                wiki: this.wiki
            });

            if($tw.keyboardManager.checkKeyDescriptors(event, keyInfoArray) && !isModalDisplayed) {
                event.stopImmediatePropagation();
                event.preventDefault();
                showModal();
            }

            if (isModalDisplayed) {
                switch (event.key) {
                    case 'Escape':
                        hideModal();
                        break;
                    case 'ArrowUp':
                        selectedIndex--;
                        if (selectedIndex < 0) {
                            selectedIndex = lastResults.length - 1;
                        }
                        refreshResults();
                        break;
                    case 'ArrowDown':
                        selectedIndex++;
                        if (selectedIndex >= lastResults.length) {
                            selectedIndex = 0;
                        }
                        refreshResults();
                        break;
                    case 'Enter':
                        navigate();
                        hideModal();
                        break;
                }
            }
        }

        function navigate() {
            var to = lastResults[selectedIndex];

            if (!to) {
                return;
            }

            var navigatorPrototype = $tw.modules.applyMethods("widget")['navigator'];
            var navigator = findNavigator($tw.rootWidget, navigatorPrototype);


            if (navigator) {
                navigator.dispatchEvent({
                    type: "tm-navigate",
                    navigateTo: to.fields.title
                });
            }
        }

        function findNavigator(widget, navigatorPrototype) {
            if (widget instanceof navigatorPrototype) {
                return widget;
            }

            for (var i = 0; i < widget.children.length; i++) {
                var child = widget.children[i];
                var navigator = findNavigator(child, navigatorPrototype);
                if (navigator) {
                    return navigator;
                }
            }

            return null;
        }

        function showModal() {
            var $body = document.querySelector('body');
            $body.classList.add('ec-goto-active');
            $body.appendChild($modal);

            $modal.querySelector('#ec-goto-input').value = "";

            document.querySelector('#ec-goto-input').focus();

            isModalDisplayed = true;
            refreshResults();
        }

        function hideModal() {
            var $body = document.querySelector('body');
            $body.classList.remove('ec-goto-active');
            $body.removeChild($modal);

            isModalDisplayed = false;
        }

        function createModal() {
            var _$modal = document.createElement('div');
            _$modal.id = "ec-goto";

            _$modal.innerHTML = $tw.wiki.getTiddler('$:/plugins/EvidentlyCube/GoToShortcut/modal.html').fields.text;

            _$modal.querySelector('#ec-goto-input').addEventListener('input', onInputChange);

            return _$modal;
        }

        function onInputChange(event) {
            lastResults = getTiddlers(event.currentTarget.value);
            selectedIndex = 0;
            refreshResults();
        }

        function refreshResults() {
            var $results = document.getElementById('ec-goto-results');
            var $moreUp = $results.querySelector('.more-up');
            var $moreDown = $results.querySelector('.more-down');
            while ($results.children.length > 2) {
                $results.removeChild($results.children[1]);
            }

            var i = Math.min(
                Math.max(0, lastResults.length - totalResults),
                Math.max(0, selectedIndex - Math.floor(totalResults / 2))
            );

            lastResults.slice(i, i + totalResults).forEach(function (tiddler) {
                $results.insertBefore(getResult(tiddler), $moreDown);
            });

            $moreUp.classList.add('hidden');
            $moreDown.classList.add('hidden');

            if (lastResults.length > totalResults) {
                if (selectedIndex > totalResults / 2) {
                    $moreUp.classList.remove('hidden');
                }
                if (selectedIndex < lastResults.length - totalResults / 2) {
                    $moreDown.classList.remove('hidden');
                }
            }

            refreshSelected();
        }

        function refreshSelected() {
            var $results = document.getElementById('ec-goto-results');

            for (var i = 0; i < $results.children.length; i++) {
                $results.children[i].classList.remove('selected');
            }

            var index = 0;
            if (lastResults.length === 0) {
                return;
            } else if (lastResults.length <= totalResults || selectedIndex < totalResults / 2) {
                index = selectedIndex;
            } else if (selectedIndex < lastResults.length - totalResults / 2) {
                index = Math.floor(totalResults / 2);
            } else {
                index = selectedIndex - lastResults.length + totalResults;
            }

            if ($results.children[index + 1]) {
                $results.children[index + 1].classList.add('selected');
            }
        }

        function getResult(tiddler) {
            var $li = document.createElement('li');
            var $header = document.createElement('header');
            var $aside = document.createElement('aside');

            $header.innerText = tiddler.fields.title;
            $aside.innerText = tiddler.fields.tags && tiddler.fields.tags.length > 0 ? tiddler.fields.tags.join(', ') : '<no tags>';
            $li.appendChild($header);
            $li.appendChild($aside);
            $li.classList.add('result');

            return $li;
        }

        function getTiddlers(query) {
            var normalizedQuery = query.toLowerCase();
            var tiddlers = [];
            $tw.wiki.each(function (tiddler, title) {
                if ($tw.wiki.isSystemTiddler(title)) {
                    return;
                }

                var normalizedTitle = title.toLowerCase();
                var regularIndex = title.indexOf(query);
                var normalizedIndex = normalizedTitle.indexOf(normalizedQuery);

                if (normalizedIndex >= 0) {
                    var score = normalizedIndex * 2;
                    if (regularIndex !== normalizedIndex) {
                        score++;
                    }

                    tiddlers.push([score, title, tiddler]);
                }
            });

            tiddlers.sort(function (left, right) {
                if (left[0] !== right[0]) {
                    return left[0] - right[0];
                } else if (left[1] < right[1]) {
                    return -1;
                } else if (left[1] > right[1]) {
                    return 1;
                } else {
                    return 0;
                }
            });

            return tiddlers.map(function (result) {
                return result[2];
            });
        }
    }
})();
