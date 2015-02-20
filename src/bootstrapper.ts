/// <reference path="js/jquery.d.ts" />
import BootstrapParams = require("bootstrapParams");
import utils = require("utils");
import util = utils.Utils;

class BootStrapper{

    params: BootstrapParams;
    manifest: any;
    extensions: any;
    sequenceIndex: number;
    sequences: any;
    sequence: any;
    configExtension: any;

    // this loads the manifest, determines what kind of extension and provider to use, and instantiates them.
    constructor(extensions: any) {
        this.extensions = extensions;
    }

    getBootstrapParams(): BootstrapParams {
        var p = new BootstrapParams();

        p.manifestUri = util.getQuerystringParameter('manifestUri');
        p.configExtensionUri = util.getQuerystringParameter('configExtensionUri');
        p.jsonp = util.getBool(util.getQuerystringParameter('jsonp'), false);
        p.isHomeDomain = util.getQuerystringParameter('isHomeDomain') === "true";
        p.isReload = util.getQuerystringParameter('isReload') === "true";
        p.locale = util.getQuerystringParameter('locale');
        p.embedDomain = util.getQuerystringParameter('embedDomain');
        p.isOnlyInstance = util.getQuerystringParameter('isOnlyInstance') === "true";
        p.embedScriptUri = util.getQuerystringParameter('embedScriptUri');
        p.domain = util.getQuerystringParameter('domain');
        p.isLightbox = util.getQuerystringParameter('isLightbox') === "true";

        return p;
    }

    bootStrap(params?: BootstrapParams): void {
        var that = this;

        that.params = this.getBootstrapParams();

        // merge new params
        if (params){
            that.params = $.extend(true, that.params, params);
        }

        // empty app div
        $('#app').empty();

        // add loading class
        $('#app').addClass('loading');

        // remove any existing css
        $('link[type*="text/css"]').remove();

        jQuery.support.cors = true;

        // if data-config has been set on embedding div, load the js
        if (that.params.configExtensionUri){

            // if "sessionstorage"
            if (that.params.configExtensionUri.toLowerCase() === "sessionstorage"){
                var config = sessionStorage.getItem("uv-config");
                that.configExtension = JSON.parse(config);
                that.loadManifest();
            } else {
                $.getJSON(that.params.configExtensionUri, (configExtension) => {
                    that.configExtension = configExtension;
                    that.loadManifest();
                });
            }
        } else {
            that.loadManifest();
        }
    }

    corsEnabled(): boolean {
        return Modernizr.cors && !this.params.jsonp
    }

    loadManifest(): void{
        var that = this;

        if (this.corsEnabled()){
            $.getJSON(that.params.manifestUri, (manifest) => {
                that.parseManifest(manifest);
            });
        } else {
            // use jsonp
            var settings: JQueryAjaxSettings = <JQueryAjaxSettings>{
                url: that.params.manifestUri,
                type: 'GET',
                dataType: 'jsonp',
                jsonp: 'callback',
                jsonpCallback: 'manifestCallback'
            };

            $.ajax(settings);

            window.manifestCallback = (manifest: any) => {
                that.parseManifest(manifest);
            };
        }
    }

    parseManifest(manifest: any): void {
        this.manifest = manifest;

        //var sequenceParam = 'si';

        //if (this.configExtension && this.configExtension.options && this.configExtension.options.IIIF) {
        //    this.IIIF = this.configExtension.options.IIIF;
        //}

        //if (!this.IIIF) sequenceParam = 'asi';

        if (this.params.isHomeDomain && !this.params.isReload) {
            this.sequenceIndex = parseInt(util.getHashParameter("si", parent.document));
        }

        if (!this.sequenceIndex) {
            this.sequenceIndex = parseInt(util.getQuerystringParameter("si")) || 0;
        }

        //if (!this.IIIF) {
        //    this.sequences = this.manifest.assetSequences;
        //} else {
            this.sequences = this.manifest.sequences;
        //}

        if (!this.sequences) {
            this.notFound();
        }

        this.loadSequence();
    }

    loadSequence(): void{

        var that = this;

        //if (!that.IIIF){
        //    // if it's not a reference, load dependencies
        //    if (!that.sequences[that.sequenceIndex].$ref) {
        //        that.sequence = that.sequences[that.sequenceIndex];
        //        that.loadDependencies();
        //    } else {
        //        // load referenced sequence.
        //        var baseManifestUri = that.params.manifestUri.substr(0, that.params.manifestUri.lastIndexOf('/') + 1);
        //        var sequenceUri = baseManifestUri + that.sequences[that.sequenceIndex].$ref;
        //
        //        $.getJSON(sequenceUri, (sequenceData) => {
        //            that.sequence = that.sequences[that.sequenceIndex] = sequenceData;
        //            that.loadDependencies();
        //        });
        //    }
        //} else {
            // if it's not a reference, load dependencies
            if (that.sequences[that.sequenceIndex].canvases) {
                that.sequence = that.sequences[that.sequenceIndex];
                that.loadDependencies();
            } else {
                // load referenced sequence.
                var sequenceUri = String(that.sequences[that.sequenceIndex]['@id']);

                $.getJSON(sequenceUri, (sequenceData) => {
                    that.sequence = that.sequences[that.sequenceIndex] = sequenceData;
                    that.loadDependencies();
                });
            }
        //}
    }

    notFound(): void{
        try{
            parent.$(parent.document).trigger("onNotFound");
            return;
        } catch (e) {}
    }

    loadDependencies(): void {

        var that = this;
        var extension;

        //if (!that.IIIF){
        //    extension = that.extensions[that.sequence.assetType];
        //} else {
            // only seadragon extension is compatible with IIIF
            extension = that.extensions['seadragon/iiif'];
        //}

        // todo: use a compiler flag when available
        var configPath = (window.DEBUG)? 'extensions/' + extension.name + '/config/' + that.params.locale + '.config.js' : 'js/' + extension.name + '.' + that.params.locale + '.config.js';

        // feature detection
        yepnope({
            test: window.btoa && window.atob,
            nope: 'js/base64.min.js',
            complete: function () {
                $.getJSON(configPath, (config) => {

                    // if data-config has been set on embedding div, extend the existing config object.
                    if (that.configExtension){
                        // save a reference to the config extension uri.
                        config.uri = that.params.configExtensionUri;

                        $.extend(true, config, that.configExtension);
                    }

                    // todo: use a compiler flag when available
                    var cssPath = (window.DEBUG)? 'extensions/' + extension.name + '/theme/' + config.options.theme + '.css' : 'themes/' + config.options.theme + '/css/' + extension.name + '/theme.css';

                    yepnope.injectCss(cssPath, function () {
                        that.createExtension(extension, config);
                    });
                });
            }
        });
    }

    createExtension(extension: any, config: any): void{
        // create provider.
        var provider = new extension.provider(this, config, this.manifest);

        // create extension.
        new extension.type(provider);
    }
}

export = BootStrapper;