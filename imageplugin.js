admin.directive('bildergalerie', function () {
    return {
        templateUrl:    'templates/dir/bildergalerie.html',
        restrict:       'AE',
        scope: {
            bindTo:     '=',
            titel:      '=titel',
            ansicht:    '=ansicht'
        },
        replace: true,
        controller: function($scope, $http, logger, FileUploader, preloader, $timeout) {
            
            //defaults
            $scope.ajax = {
                status: null,
                files: [],
                fileComp: true,
                delete: null,
                pfad: ['img'],
                progress: 0,
                sort: false,
                newFolder: false,
                folderName: ""
            };
            //setter
            $scope.setBild = function (img) {
                $scope.bindTo = img;
            };
            
            //getter
            
            //vars
            $scope.upload = {
                aktiv: false,
                fertig: false
            };
            
            
            //inits
            if ($scope.ansicht === 'liste') {
                $scope.ajax.fileComp = false;
            }
            
            $timeout(function () { //FIX: undefined ohne timeout
                $scope.ajax.pfad = resolve($scope.bindTo);
                loadImages();
            }, 1500);
            
            
            
            //HELPER
            
            //Aus Pfad Array machen
            var resolve = function (pfad) {
                var idx = pfad.indexOf('img');
                if (idx === -1) {
                    return ['img'];
                } else {
                    var idx2 = pfad.lastIndexOf('/');
                    var ss;
                    if (idx === idx2) {
                        return ['img'];
                    } else {
                        ss = pfad.substring(idx, idx2);
                        return ss.split('/');
                    }
                }
            };
            
            var fileExists = function (fname) {
                for (var i = 0; i < $scope.ajax.files.length; i++) {
                    var cname = $scope.ajax.files[i].name + "." + $scope.ajax.files[i].type;
                    if (cname === fname)
                        return true;
                }
                return false;
            };
            
            //FUNKTIONEN
            //private
            
            //http Bilder laden und preloaden
            var imgList = function () {
                var pfad = $scope.ajax.pfad.join('/');
                $http.get('ajax/?do=getimages', { params: {path: pfad} })
                    .then(function (data) {

                        if (data.data.result > 0) {
                            $scope.ajax.files = data.data.files;
                            $scope.$emit('content.changed');

                            var onlyFolders = true;
                            for (var j = 0; j < data.data.files; j++) {
                                if (!data.data.files[j].isFolder) {
                                    onlyFolders = false;
                                    break;
                                }
                            }
                            if (onlyFolders) {
                                $scope.ajax.progress = 100;
                                $scope.ajax.status = 1;
                            } else {
                                preloader.preloadImages(data.data.files)
                                    .then(function handleResolve() {
                                        $scope.ajax.status = 1;
                                    },
                                    function handleReject () {
                                        $scope.ajax.status = -1;
                                    },
                                    function handleNotify (event) {
                                        $scope.ajax.progress = event.percent;
                                    });
                            }
                        } else if (data.data.result === 0) {
                            $scope.ajax.status = 0; 
                        } else {
                            $scope.ajax.status = -1; 
                        }
                    }, function () {
                        $scope.ajax.status = -1;
                });
            };
            
            var loadImages = function () {
                $scope.ajax.status = null;
                $scope.ajax.progress = 0;
                $scope.ajax.files = [];
                imgList();
            };
            
            
            //public (scope)
            
            //goto pfad
            $scope.goTo = function (pfad) {
                $scope.ajax.pfad.push(pfad);
                loadImages();
            };
            
            //goto breadcrumb-click
            $scope.goToBC = function (index) {
                var start = $scope.ajax.pfad.length - 1;
                for (var i = start; i > index; i--) {
                    $scope.ajax.pfad.pop();
                }
                loadImages();
            };
            
            $scope.goBack = function () {
                $scope.ajax.pfad.pop();
                loadImages();
            };

            

            //Uploader
            
            //init uploader
            $scope.linkUpload = new FileUploader({
                url: 'ajax/upload.php',
                onCompleteAll: function () {
                    $scope.upload.fertig = true;
                },
                onAfterAddingFile: function (item) {
                    $scope.linkUpload.queue[$scope.linkUpload.getIndexOfItem(item)].exists = fileExists(item.file.name);
                    $scope.linkUpload.queue[$scope.linkUpload.getIndexOfItem(item)].formData.push({
                        pfad: $scope.ajax.pfad.join("/")
                    });
                }
            });

            $scope.linkUpload.filters.push({
                name: 'imageFilter',
                fn: function(item /*{File|FileLikeObject}*/, options) {
                    var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
                    return '|jpg|png|jpeg|bmp|gif|svg'.indexOf(type) !== -1; //jpeg, jpg, png, bmp, gif
                }
            });
            
            //events
            $scope.startUploading = function () {
                $scope.linkUpload.uploadAll();
            };
            $scope.finish = function () {
                $scope.upload.fertig = false; 
                $scope.linkUpload.clearQueue();
                $scope.upload.aktiv = false;
                loadImages();

            };
            
            //ordner
            //anzeige
            $scope.newFolder = function () {
                $scope.ajax.newFolder = true;
            };
            //speichern
            $scope.saveFolder = function () {
                $http.post('../ajax/?do=neuerordner', {pfad: $scope.ajax.pfad.join("/"), name: $scope.ajax.folderName}).then(function (res) {
                   if (res.data.result === 1) {
                        logger.add("Der Ordner wurde gespeichert.", "fa-check-circle-o", "success");
                        $scope.ajax.files.push({
                            name: $scope.ajax.folderName,
                            isFolder: true,
                            size: "0.00",
                            type: "ordner",
                            src: ".." + $scope.ajax.pfad.join("/") + "/" + $scope.ajax.folderName,
                            unit: "B"
                        });
                        $scope.ajax.newFolder = false;
                        $scope.ajax.folderName = "";
                   } else {
                      logger.add("Fehler beim Speichern.", "fa-trash-o", "danger");  
                   }
                }, function () {
                   logger.add("Fehler beim Speichern.", "fa-trash-o", "danger"); 
                });
            };
            //löschen
            /*
             */
            
            
            //DATEIEN
            //löschen
            $scope.deleteFile = function (el) {
                var action = (el.isFolder)?'deletefolder':'deletefile';
                $http.post('../ajax/?do='+action, {pfad: el.src}).then(function (res) {
                   if (res.data.result === 1) {
                       var text = (el.isFolder)?"Der Ordner " + el.name + " und alle Dateien darin wurden gelöscht.":"Die Datei " + el.name + " wurde gelöscht.";
                       logger.add(text, "fa-check-circle-o", "success");
                       var idx = $scope.ajax.files.indexOf(el);
                       $scope.ajax.files.splice(idx, 1);
                       $scope.$emit('content.changed');
                   } else {
                       logger.add("Fehler beim Löschen.", "fa-trash-o", "danger");  
                   }
                }, function () {
                    logger.add("Fehler beim Löschen.", "fa-trash-o", "danger");  
                });
            };

            
        }
    };
});