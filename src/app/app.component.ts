import { Component, Injector, Input,
    ViewChild, ViewContainerRef, ComponentFactoryResolver, OnDestroy, OnInit, DoCheck, HostListener, AfterViewInit } from '@angular/core';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { _parameterTypes } from '@assets/core/modules';
import { FileHandle } from './directives/dragDropDirective';
import { DataService as GIDataService } from './gi-viewer/data/data.service';
import { Viewers } from './model-viewers.config';
import { DataService } from './services/data.service';
import { IView } from './view.interface';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements DoCheck, OnInit, OnDestroy, AfterViewInit {
    files: FileHandle[] = [];

    @ViewChild('vc', { read: ViewContainerRef, static: true }) vc: ViewContainerRef;
    data = null;
    private views = [];
    private activeView: IView;
    Viewers = Viewers;

    constructor(private matIconRegistry: MatIconRegistry, private domSanitizer: DomSanitizer,
        private injector: Injector, private r: ComponentFactoryResolver, private dataService: DataService,
        private giDataService: GIDataService) {
        this.matIconRegistry.addSvgIcon('settings', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/Settings.svg'));
        this.matIconRegistry.addSvgIcon('select', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/Select.svg'));
        this.matIconRegistry.addSvgIcon('cZoom', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/Zoom.svg'));
        this.matIconRegistry.addSvgIcon('cControlCam', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/ControlCam.svg'));
        this.matIconRegistry.addSvgIcon('cVisibility', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/visibility.svg'));
        this.matIconRegistry.addSvgIcon('c3D Viewer', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/3D2.svg'));
        this.matIconRegistry.addSvgIcon('cGeo Viewer', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/Icons/Geo.svg'));
        this.data = _parameterTypes.newFn();
    }
    /**
     * ngOnInit
     */
    ngOnInit() {
        this.activeView = this.Viewers[0];
        if (this.dataService.activeView) {
            for (const view of this.Viewers) {
                if (view.name === this.dataService.activeView) {
                    this.activeView = view;
                }
            }
        }
        if (this.activeView.name !== '3D Viewer') {
            this.giDataService.switch_page = false;
        }
        this.updateView( this.activeView );
    }
    /**
     * ngOnDestroy
     */
    ngOnDestroy() {
        this.dataService.activeView = this.activeView.name;
        this.vc.clear();
        for (const view in this.views) {
            if (this.views[view]) {
                this.views[view].destroy();
            }
        }
    }
    /**
     * ngDoCheck
     */
    ngDoCheck() {
        if (this.dataService.helpView[0] === true) {
            let view;
            for (const v of this.Viewers) {
                if (v.name === 'Help') { view = v; }
            }
            this.dataService.toggleViewHelp(false);
            this.updateView(view);
        } else { this.updateValue(); }
    }
    ngAfterViewInit() {
        setTimeout(() => {
            const container = document.getElementById('dummy_container');
            if (container.childElementCount === 0) {
                const publishElement = document.createElement('div');
                publishElement.setAttribute('id', 'published');
                container.appendChild(publishElement);
                this.dataService.attribVal = 0;
            }
        }, 0);
    }
    /**
     * createView
     * @param view
     */
    createView(view: IView) {
        const component = view.component;
        const factory = this.r.resolveComponentFactory(component);
        const componentRef = factory.create(this.injector);
        /*
        if (view.name != 'Console'){
            componentRef.instance["data"] = this.data;
        }
        */
        return componentRef;
    }
    /**
     * updateView
     * @param view
     */
    updateView(view: IView): void {
        this.activeView = view;

        if ( this.views[ this.activeView.name ] === undefined) {
            this.views[ this.activeView.name ] = this.createView(view);
        }

        this.updateValue();

        this.vc.detach();
        this.vc.insert( this.views[ this.activeView.name ].hostView );
    }
    /**
     * updateValue
     */
    updateValue() {
        try {
            const componentRef =  this.views[ this.activeView.name ];
            if (this.activeView.name === 'Help') {
                // componentRef.instance['output'] = this.dataService.helpView[1];
            } else if (this.activeView.name !== 'Console') {
                componentRef.instance['data'] = this.data;
            // } else {
            //     componentRef.instance['scrollcheck'] = true;
            }
        } catch (ex) {
            // console.log(`Active View not defined`);
        }
    }

    async filesDropped(files: FileHandle[]) {
        if (files.length === 0) { return; }
        const f = files[0];
        try {
            const fileReader = new FileReader();
            fileReader.onload = (e) => {
                this.data = _parameterTypes.newFn();
                this.data.setJSONStr(fileReader.result);
            };
             fileReader.readAsText(f.file, 'json/applications');
        } catch (ex) {
            return;
        }
    }

    @HostListener('window:message', ['$event'])
    onWindowMessage(event: MessageEvent) {
        if (!event.data.messageType) {
            return;
        }
        switch (event.data.messageType) {
            case 'update':
                if (!event.data.url && !event.data.model) { return; }
                if (event.data.url) {
                    fetch(event.data.url).then(
                        res => {
                        if (!res.ok) { return; }
                        res.text().then(giText => {
                            const newModel = _parameterTypes.newFn();
                            newModel.setJSONStr(giText);
                            this.data = newModel;
                        });
                    });
                } else {
                    const newModel = _parameterTypes.newFn();
                    newModel.setJSONStr(event.data.model);
                    this.data = newModel;
                }
                if (event.data.keepSettings || event.data.keepCamera) {
                } else {
                    setTimeout(() => {
                        const zoomfit = document.getElementById('zoomingfit');
                        if (zoomfit) { zoomfit.click(); }
                    }, 0);
                }
                break;
            case 'update_settings':
                if (event.data.GI_settings) {
                    const oldSettings = JSON.parse(localStorage.getItem('mpm_settings'));
                    let newSettings = event.data.GI_settings;
                    if (typeof newSettings === 'string') {
                        newSettings = JSON.parse(newSettings);
                    }
                    this.settingsCheck(newSettings, oldSettings)
                    localStorage.setItem('mpm_settings', JSON.stringify(newSettings));
                    this.dataService.viewerSettingsUpdated = true
                    if (newSettings.camera && newSettings.camera.pos && newSettings.camera.target) {
                        const updateGIPosButton = document.getElementById('updateGICamera');
                        if (updateGIPosButton) { updateGIPosButton.click(); }
                    }
                }
                if (event.data.Geo_settings) {
                    const oldSettings = JSON.parse(localStorage.getItem('geo_settings'));
                    let newSettings = event.data.Geo_settings;
                    if (typeof newSettings === 'string') {
                        newSettings = JSON.parse(newSettings);
                    }
                    this.settingsCheck(newSettings, oldSettings)
                    localStorage.setItem('geo_settings', JSON.stringify(newSettings));
                    this.dataService.viewerSettingsUpdated = true
                }
                // const model = this.data;
                // this.data = _parameterTypes.newFn();
                // setTimeout(() => {
                //     this.data = model;
                // }, 0);
                break;
            case 'get_localstorage_list':
                let fileList = JSON.parse(localStorage.getItem('mobius_backup_list'));
                if (!fileList) {
                    fileList = [];
                }
                window.parent.postMessage({
                    messageType: 'localstorage_list',
                    file_list: fileList
                }, '*');
                break;
            case 'zoom_to_fit':
                const giZoom = document.getElementById('zoomingfit');
                if (giZoom) { giZoom.click(); }
                const cesiumZoom = document.getElementById('cesium_zoom_fit');
                if (cesiumZoom) { cesiumZoom.click(); }
                break;
        }
        const container = document.getElementById('dummy_container');
        if (!event.data.showAttrTable) {
            if (container.childElementCount === 0) {
                const publishElement = document.createElement('div');
                publishElement.setAttribute('id', 'published');
                container.appendChild(publishElement);
                this.dataService.attribVal = 0;
            }
        } else if (container.childElementCount > 0) {
            container.removeChild(container.firstElementChild);
            this.dataService.attribVal = 34;
        }
    }
    settingsCheck(obj1, obj2, checkChildren = true) {
        for (const i in obj2) {
            if (!obj1.hasOwnProperty(i)) {
                obj1[i] = JSON.parse(JSON.stringify(obj2[i]));
            } else if (checkChildren && obj1[i].constructor === {}.constructor && obj2[i].constructor === {}.constructor) {
                this.settingsCheck(obj1[i], obj2[i], false);
            }
        }
    }
}
